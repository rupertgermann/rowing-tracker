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
      verbosity = 'low'
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

    const recent = sortedSessions.slice(Math.max(0, sortedSessions.length - 20)).map(s => ({
      date: new Date(s.timestamp).toISOString().split('T')[0],
      distance: s.distance,
      duration: s.duration,
      avgSplit: s.avgSplit,
      avgPower: s.avgPower,
      avgStrokeRate: s.avgStrokeRate
    }));

    const prompt = `${customPrompt || ''}

AVAILABLE ACHIEVEMENTS (ONLY THESE IDs ARE VALID):
${unearnedAwards.map(a => `- ${a.id}: ${a.title} — ${a.description}`).join('\n')}

CURRENT TOTALS:
- totalSessions: ${sortedSessions.length}
- totalDistanceMeters: ${totalDistance}
- totalDurationSeconds: ${totalDuration}

RECENT SESSIONS (most recent last):
${JSON.stringify(recent, null, 2)}

Return suggestions for up to ${maxSuggestions} achievements. Do not include already earned achievements.`.trim();

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 800,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const outputText = (data && typeof data.output_text === 'string') ? data.output_text : null;
    if (!outputText) {
      return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
    }

    let parsed: SuggestionResponse;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
