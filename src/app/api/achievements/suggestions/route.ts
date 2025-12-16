import { NextRequest, NextResponse } from 'next/server';
import { AWARDS } from '@/lib/awards';

type ReasoningSetting = 'minimal' | 'low' | 'medium' | 'high';

type VerbositySetting = 'low' | 'medium' | 'high';

interface SuggestionCriteria {
  type: string;
  value: number;
  comparison: string;
}

interface SuggestionResponse {
  suggestions: Array<{
    id: string;
    title: string;
    description: string;
    rationale: string;
    criteria?: SuggestionCriteria;
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
      earnedAwards: earnedAwardsInput,
      maxSuggestions = 5,
      customPrompt,
      apiKey,
      model = 'gpt-5-mini',
      reasoning = 'low',
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
      earnedAwards?: Array<{ awardId: string; earnedAt: string }>;
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

    const earnedAwardsList = Array.isArray(earnedAwardsInput) ? earnedAwardsInput : [];

    const earnedAwardsForPrompt = earnedAwardsList
      .map(e => {
        const award = AWARDS.find(a => a.id === e.awardId);
        if (!award) return null;
        const earnedDate = e.earnedAt ? new Date(e.earnedAt).toISOString().split('T')[0] : 'unknown';
        return `- "${award.title}" — ${award.description} (earned: ${earnedDate})`;
      })
      .filter(Boolean)
      .join('\n');

    // Build list of all existing awards to prevent duplicates
    const existingAwardsList = AWARDS.map(a => `- "${a.title}": ${a.description}`).join('\n');

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

    const prompt = `ALREADY EARNED ACHIEVEMENTS (for context):

${earnedAwardsForPrompt || '(none yet)'}

EXISTING AWARDS IN THE APP (DO NOT suggest duplicates or variations of these — they already exist):

${existingAwardsList}

CURRENT TOTALS:
- totalSessions: ${sortedSessions.length}
- totalDistanceMeters: ${totalDistance}
- totalDurationSeconds: ${totalDuration}

RECENT SESSIONS (most recent last):
${JSON.stringify(recent, null, 2)}

Suggest up to ${maxSuggestions} NEW achievement ideas. Be creative! You can:
- Suggest new milestones in existing categories
- Invent entirely new award categories (e.g., consistency, weekly goals, personal bests, technique)
- Create fun/motivational achievements tailored to this athlete's progress

IMPORTANT: For each suggestion, include machine-parseable "criteria" so the app can automatically detect when the award is earned.
Criteria types:
- total_distance: Total meters rowed across all sessions
- total_duration: Total seconds rowed across all sessions  
- total_sessions: Number of sessions completed
- single_session_distance: Distance in a single session (meters)
- single_session_duration: Duration of a single session (seconds)
- single_session_power: Average power in a single session (watts)
- single_session_pace: Pace in a single session (seconds per 500m, lower is faster)
- weekly_sessions: Number of sessions in a single week
- streak_days: Consecutive days with sessions
- custom: For criteria that can't be auto-evaluated (user marks manually)`.trim();

    const instructions = `${customPrompt || ''}

Return ONLY valid JSON that matches the required schema. Do not include markdown, code fences, or extra text.

Keep output short:
- suggestions: at most ${maxSuggestions}
- rationale: 1-2 short sentences
- criteria: REQUIRED - use appropriate type, value, and comparison (gte/lte/eq)
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
                        id: { type: 'string', description: 'Unique kebab-case ID for the award (e.g., weekly-warrior, power-surge)' },
                        title: { type: 'string', description: 'Short catchy title (2-4 words)' },
                        description: { type: 'string', description: 'Brief description of how to earn this award' },
                        rationale: { type: 'string', description: 'Why this award is suggested for this athlete' },
                        criteria: {
                          type: 'object',
                          description: 'Machine-parseable criteria for automatic evaluation',
                          properties: {
                            type: { 
                              type: 'string', 
                              enum: ['total_distance', 'total_duration', 'total_sessions', 'single_session_distance', 'single_session_duration', 'single_session_power', 'single_session_pace', 'weekly_sessions', 'streak_days', 'custom'],
                              description: 'Type of criteria to evaluate'
                            },
                            value: { type: 'number', description: 'Threshold value (meters for distance, seconds for duration/pace, count for sessions, watts for power)' },
                            comparison: { type: 'string', enum: ['gte', 'lte', 'eq'], description: 'gte=greater-or-equal, lte=less-or-equal, eq=equal' }
                          },
                          required: ['type', 'value', 'comparison'],
                          additionalProperties: false
                        },
                        targetDate: { type: ['string', 'null'], description: 'Estimated date to achieve (YYYY-MM-DD) or null' }
                      },
                      required: ['id', 'title', 'description', 'rationale', 'criteria', 'targetDate'],
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

    const filtered = (parsed.suggestions || [])
      .filter(s => s && typeof s.id === 'string' && typeof s.title === 'string' && typeof s.description === 'string')
      .slice(0, Math.max(0, Math.min(10, maxSuggestions)))
      .map(s => ({
        id: String(s.id).trim(),
        title: String(s.title).trim(),
        description: String(s.description).trim(),
        rationale: String(s.rationale || '').trim(),
        criteria: s.criteria && typeof s.criteria === 'object' ? {
          type: String(s.criteria.type || 'custom'),
          value: Number(s.criteria.value) || 0,
          comparison: String(s.criteria.comparison || 'gte')
        } : undefined,
        targetDate: s.targetDate ? String(s.targetDate) : undefined
      }))
      .filter(s => s.id.length > 0 && s.title.length > 0 && s.description.length > 0);

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
