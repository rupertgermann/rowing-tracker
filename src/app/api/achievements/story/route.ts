import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, earnedAt, customPrompt, apiKey } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: title and description' },
        { status: 400 }
      );
    }

    // Use provided API key or fall back to environment variable
    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 401 }
      );
    }

    // Build the prompt
    const defaultPrompt = `You are a creative writer crafting inspiring achievement stories for rowers. 
Write a short, motivational story (2-3 paragraphs, ~150-200 words) celebrating a rowing achievement.

The story should:
- Be personal and emotionally engaging
- Reference the specific achievement and what it represents
- Include vivid imagery related to rowing (water, oars, rhythm, power)
- End with an inspiring message about the journey ahead
- Be written in second person ("You have...")

Achievement Details:
Title: {title}
Description: {description}
Earned On: {earnedAt}

Write the achievement story:`;

    const prompt = (customPrompt || defaultPrompt)
      .replace('{title}', title)
      .replace('{description}', description)
      .replace('{earnedAt}', earnedAt || new Date().toLocaleDateString());

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
        max_output_tokens: 500,
        reasoning: { effort: 'low' },
        text: { verbosity: 'medium' }
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
    
    // Extract the story text from the response
    let story = '';
    
    // Check for output_text helper
    if (data.output_text) {
      story = data.output_text;
    } else {
      // Manual parsing
      const messageOutput = data.output?.find(
        (item: any) => item.type === 'message'
      );
      
      if (messageOutput?.content?.length > 0) {
        const textContent = messageOutput.content.find(
          (c: any) => c.type === 'output_text'
        );
        if (textContent?.text) {
          story = textContent.text;
        }
      }
    }

    if (!story) {
      return NextResponse.json(
        { error: 'Failed to generate story' },
        { status: 500 }
      );
    }

    return NextResponse.json({ story });
  } catch (error) {
    console.error('Achievement story generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
