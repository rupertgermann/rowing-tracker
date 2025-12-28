import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/settings';
import { getColorPalettePrompt } from '@/lib/achievementColors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      title, 
      description, 
      customPrompt, 
      apiKey, 
      size = '1024x1024',
      quality = 'auto',  // auto, high, medium, low
      model = 'gpt-image-1',  // gpt-image-1, gpt-image-1-mini, gpt-image-1.5
      story
    } = body;

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

    const allowedSizes = ['1024x1024', '1024x1536', '1536x1024', 'auto'];
    if (!allowedSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Supported values: ${allowedSizes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build the image prompt
    const isDev = process.env.NODE_ENV === 'development';

    // Load AI settings to get selected color palette
    const settings = SettingsService.getInstance();
    const aiSettings = settings.getAISettings();
    const colorPalette = getColorPalettePrompt(aiSettings.achievementImageColors || 'classic');

    const defaultPrompt = `Create a stunning, celebratory achievement certificate/card image for a rowing accomplishment.

Achievement: {title}
Description: {description}

Style guidelines:
- Modern, clean design with elegant typography
- Incorporate rowing imagery (stylized oars, water ripples, rowing silhouette)
- Use a color palette of ${colorPalette}
- Include decorative elements suggesting achievement (laurels, ribbons, stars)
- The image should feel prestigious and celebratory
- Do NOT include any text - the text will be overlaid separately
- High quality, suitable for display`;

    let prompt = (customPrompt || defaultPrompt)
      .replace('{title}', title)
      .replace('{description}', description)
      // Replace any hardcoded color palette with the user's selected colors
      .replace(/Use a color palette of [^\n]+/i, `Use a color palette of ${colorPalette}`);

    // Ensure the award title is visible on the certificate/card
    prompt += `\n\nClearly render the award title "${title}" on the certificate/card in the foreground so it is readable and prominent.`;

    // If a story already exists, include it for better coherence and background alignment
    const storyText = typeof story === 'string' ? story.trim() : '';
    if (storyText) {
      prompt += `\n\nHere is the achievement story to keep visual consistency:\n${storyText}\n\nCreate the background so it visually reflects the mood, setting, and key imagery from this story. Place the award certificate/card clearly in the foreground in front of that story-inspired background.`;
    } else {
      prompt += `\n\nPlace the award certificate/card clearly in the foreground, with a complementary background that feels appropriate for this achievement.`;
    }

    // Call OpenAI Image API with GPT image models
    // See: https://platform.openai.com/docs/api-reference/images/create
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        n: 1,
        size: size,
        // quality parameter: 'auto' (default), 'high', 'medium', 'low' for GPT image models
        quality: quality,
        // GPT image models return b64_json by default, output_format controls the format
        output_format: 'png'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Image API error:', errorText);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract the image data
    if (!data.data || data.data.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      );
    }

    const imageData = data.data[0];
    const imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    const revisedPrompt = imageData.revised_prompt;

    return NextResponse.json({ 
      imageUrl,
      revisedPrompt,
      sentPrompt: prompt
    });
  } catch (error) {
    console.error('Achievement image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
