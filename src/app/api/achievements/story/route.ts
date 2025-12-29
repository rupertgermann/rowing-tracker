import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, earnedAt, customPrompt, apiKey, imageUrl } = body;

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

    // Load AI settings from database
    const settings = SettingsService.getInstance();
    const aiSettings = settings.getAISettings();
    const useCaseConfig = aiSettings.achievementText;

    // Map model for API compatibility
    const mapModel = (model: string): 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.1' => {
      if (model === 'gpt-5-nano') return 'gpt-5-nano';
      if (model === 'gpt-5-mini') return 'gpt-5-mini';
      if (model === 'gpt-5.1' || model === 'gpt-5.2') return 'gpt-5.1';
      return 'gpt-5-mini'; // default fallback
    };

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

    let prompt = (customPrompt || defaultPrompt)
      .replace('{title}', title)
      .replace('{description}', description)
      .replace('{earnedAt}', earnedAt || new Date().toLocaleDateString());

    // If an image already exists, include it in the prompt for better story-image coherence
    if (imageUrl) {
      prompt += `\n\nYou also have an existing achievement image at this data URL or link:\n${imageUrl}\nDescribe the scene consistently with that visual.`;
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mapModel(useCaseConfig.model),
        input: prompt,
        max_output_tokens: 500,
        reasoning: { effort: useCaseConfig.reasoning },
        text: { verbosity: useCaseConfig.verbosity }
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
        (item: { type: string }) => item.type === 'message'
      );

      if (messageOutput?.content?.length > 0) {
        const textContent = messageOutput.content.find(
          (c: { type: string }) => c.type === 'output_text'
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
