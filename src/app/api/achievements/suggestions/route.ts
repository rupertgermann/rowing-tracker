import { NextRequest, NextResponse } from 'next/server';
import { AWARDS } from '@/lib/awards';

type ReasoningSetting = 'minimal' | 'low' | 'medium' | 'high';

type VerbositySetting = 'low' | 'medium' | 'high';

interface SuggestionResponse {
  suggestions: Array<{
    awardId: string;
    rationale: string;
    targetDate?: string;
  }>;
}

function extractResponseTextOrJson(data: any): { kind: 'text' | 'json'; value: string } | null {
  if (data?.status === 'incomplete') {
    const reason = data?.incomplete_details?.reason || 'unknown';
    throw new Error(`Response incomplete: ${reason}`);
  }

  // output_text helper (works for normal text responses, sometimes also for json_schema)
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return { kind: 'text', value: data.output_text };
  }

  const outputItems = Array.isArray(data?.output) ? data.output : [];

  // Search all message content parts for output_text/output_json/refusal
  for (const item of outputItems) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item?.content) ? item.content : [];

    const refusal = content.find((c: any) => c?.type === 'refusal');
    if (refusal) {
      const refusalText = typeof refusal?.refusal === 'string' ? refusal.refusal : 'Model refusal';
      throw new Error(refusalText);
    }

    const jsonPart = content.find((c: any) => c?.type === 'output_json' && c?.json);
    if (jsonPart?.json) {
      return { kind: 'json', value: JSON.stringify(jsonPart.json) };
    }

    const textPart = content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string');
    if (textPart?.text && textPart.text.trim()) {
      return { kind: 'text', value: textPart.text };
    }
  }

  // Fallback: sometimes the API returns structured output without output_text; log summary for debugging.
  return null;
}

function mapReasoningEffort(model: string, reasoning: ReasoningSetting): 'none' | 'minimal' | 'low' | 'medium' | 'high' {
  if (reasoning === 'minimal') {
    return model === 'gpt-5.1' ? 'none' : 'minimal';
  }
  return reasoning;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      sessions,
      earnedAwardIds,
      maxSuggestions = 5,
      customPrompt,
      apiKey,
      model = 'gpt-5-mini',
      reasoning = 'medium',
      verbosity = 'low',
      maxOutputTokens
    } = body as {
      sessions: Array<{
        timestamp: string;
        distance: number;
        duration: number;
        avgSplit: number;
        avgPower: number;
        avgStrokeRate: number;
      }>;
      earnedAwardIds: string[];
      maxSuggestions?: number;
      customPrompt?: string;
      apiKey?: string;
      model?: string;
      reasoning?: ReasoningSetting;
      verbosity?: VerbositySetting;
      maxOutputTokens?: number;
    };

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: 'Missing sessions' }, { status: 400 });
    }

    const earned = new Set(Array.isArray(earnedAwardIds) ? earnedAwardIds : []);
    const unearnedAwards = AWARDS.filter(a => !earned.has(a.id));

    if (unearnedAwards.length === 0) {
      return NextResponse.json({ suggestions: [] } satisfies SuggestionResponse);
    }

    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 401 }
      );
    }

    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const totalDistance = sortedSessions.reduce((acc, s) => acc + (s.distance || 0), 0);
    const totalDuration = sortedSessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    const recent = sortedSessions.slice(Math.max(0, sortedSessions.length - 12)).map(s => ({
      date: new Date(s.timestamp).toISOString().split('T')[0],
      distance: s.distance,
      duration: s.duration,
      avgSplit: s.avgSplit,
      avgPower: s.avgPower,
      avgStrokeRate: s.avgStrokeRate
    }));

    const prompt = `AVAILABLE ACHIEVEMENTS (ONLY THESE IDs ARE VALID):

${unearnedAwards.map(a => `- ${a.id}: ${a.title}`).join('\n')}

CURRENT TOTALS:
- totalSessions: ${sortedSessions.length}
- totalDistanceMeters: ${totalDistance}
- totalDurationSeconds: ${totalDuration}

RECENT SESSIONS (most recent last):
${JSON.stringify(recent, null, 2)}

Return suggestions for up to ${maxSuggestions} achievements. Do not include already earned achievements.`.trim();

    const instructions = `${customPrompt || ''}

Return ONLY valid JSON that matches the required schema. Do not include markdown, code fences, or extra text.

Keep output short:
- suggestions: at most ${maxSuggestions}
- rationale: 1-2 short sentences
- targetDate: ISO date (YYYY-MM-DD) or null`.trim();

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const initialMaxOutputTokens = clamp(
      typeof maxOutputTokens === 'number' ? maxOutputTokens : 2500,
      800,
      6000
    );

    const callOpenAI = async (requestedMaxOutputTokens: number) => {
      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: prompt,
          instructions,
          max_output_tokens: requestedMaxOutputTokens,
          reasoning: { effort: mapReasoningEffort(model, reasoning) },
          text: {
            verbosity,
            format: {
              type: 'json_schema',
              name: 'award_suggestions',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        awardId: { type: 'string' },
                        rationale: { type: 'string' },
                        targetDate: { type: ['string', 'null'] }
                      },
                      required: ['awardId', 'rationale', 'targetDate'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('OpenAI API error:', errorText);
        return NextResponse.json(
          { error: `OpenAI API error: ${resp.status}`, details: errorText },
          { status: resp.status }
        );
      }

      const json = await resp.json();
      return json;
    };

    let data: any = await callOpenAI(initialMaxOutputTokens);
    // If callOpenAI returned an HTTP NextResponse due to OpenAI error, return it.
    if (data instanceof Response) {
      return data;
    }

    if (data?.status === 'incomplete' && data?.incomplete_details?.reason === 'max_output_tokens' && initialMaxOutputTokens < 6000) {
      const retryMax = clamp(initialMaxOutputTokens * 2, 800, 6000);
      data = await callOpenAI(retryMax);
      if (data instanceof Response) {
        return data;
      }
    }
    const extracted = extractResponseTextOrJson(data);
    if (!extracted) {
      const outputTypes = Array.isArray(data?.output) ? data.output.map((o: any) => o?.type).filter(Boolean) : [];
      console.error('OpenAI response had no extractable content.', {
        status: data?.status,
        outputTypes,
        incomplete_details: data?.incomplete_details
      });
      return NextResponse.json({ error: 'Failed to generate suggestions', details: 'No extractable content from model response' }, { status: 500 });
    }

    let parsed: SuggestionResponse;
    try {
      parsed = JSON.parse(extracted.value);
    } catch (e) {
      console.error('Failed to parse JSON from AI output:', extracted.value);
      return NextResponse.json({ error: 'Invalid JSON from AI', details: extracted.value.slice(0, 1000) }, { status: 500 });
    }

    const allowedIds = new Set(unearnedAwards.map(a => a.id));
    const filtered = (parsed.suggestions || [])
      .filter(s => s && typeof s.awardId === 'string' && allowedIds.has(s.awardId))
      .slice(0, Math.max(0, Math.min(10, maxSuggestions)))
      .map(s => ({
        awardId: s.awardId,
        rationale: String(s.rationale || '').trim(),
        targetDate: s.targetDate ? String(s.targetDate) : undefined
      }))
      .filter(s => s.rationale.length > 0);

    return NextResponse.json({ suggestions: filtered } satisfies SuggestionResponse);
  } catch (error) {
    console.error('Award suggestions generation error:', error);
    const isDev = process.env.NODE_ENV === 'development';
    const details =
      isDev && error instanceof Error
        ? { message: error.message, stack: error.stack }
        : undefined;
    return NextResponse.json({ error: 'Internal server error', details }, { status: 500 });
  }
}
