import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      title, 
      description, 
      customPrompt, 
      apiKey,
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

    // Load AI settings from database
    const settings = SettingsService.getInstance();
    const aiSettings = settings.getAISettings();
    let size = aiSettings.achievementImageSize;
    const quality = aiSettings.achievementImageQuality;
    const model = aiSettings.achievementImageModel;

    // Handle 'auto' size - default to 1024x1024
    if (size === 'auto') {
      size = '1024x1024';
    }

    const allowedSizes = ['1024x1024', '1024x1536', '1536x1024'];
    if (!allowedSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Supported values: ${allowedSizes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build the image prompt
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('Achievement Image Generation Settings:');
      console.log('- Model:', model);
      console.log('- Size:', size);
      console.log('- Quality:', quality);
    }

    const defaultPrompt = `Create a stunning, celebratory achievement certificate/card image for a rowing accomplishment.

Achievement: {title}
Description: {description}

Style guidelines:
- Modern, clean design with elegant typography
- Incorporate rowing imagery (stylized oars, water ripples, rowing silhouette)
- Use a color palette of deep blues, golds, and whites
- Denim and gold meld, Shield in tradition's curve, unfolds boldly,  Innovative weave in era. 
- Include decorative elements suggesting achievement (laurels, ribbons, stars)
- The image should feel prestigious and celebratory
- Do NOT include any text - the text will be overlaid separately
- Aspect ratio award: Square 1:1
- Aspect ratio for the whole image: lanscape
- good quality, suitable for display`;

    if (isDev) console.log('defaultPrompt:', defaultPrompt);

    let prompt = (customPrompt || defaultPrompt)
      .replace('{title}', title)
      .replace('{description}', description);

    // Ensure the award title is visible on the certificate/card
    prompt += `\n\nClearly render the award title "${title}" on the certificate/card in the foreground so it is readable and prominent.`;

    // If a story already exists, include it for better coherence and background alignment
    const storyText = typeof story === 'string' ? story.trim() : '';
    if (isDev) {
      console.log('image route incoming story (raw type/len):', typeof story, story?.length ?? 'n/a');
      console.log('image route storyText length after trim:', storyText.length);
    }
    if (storyText) {
      prompt += `\n\nHere is the achievement story to keep visual consistency:\n${storyText}\n\nCreate the background so it visually reflects the mood, setting, and key imagery from this story. Place the award certificate/card clearly in the foreground in front of that story-inspired background.`;
    } else {
      prompt += `\n\nPlace the award certificate/card clearly in the foreground, with a complementary background that feels appropriate for this achievement.`;
    }
    if (isDev) console.log('finalPrompt:', prompt);

    // Prepare request body
    const requestBody = {
      model: model,
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
      response_format: 'b64_json'
    };

    if (isDev) {
      console.log('OpenAI Image API Request Body:');
      console.log(JSON.stringify(requestBody, null, 2));
    }

    // Call OpenAI Image API with GPT image models
    // See: https://platform.openai.com/docs/api-reference/images/create
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Image API error:', errorText);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}. ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (isDev) {
      console.log('OpenAI Image API Response (metadata):');
      console.log('- Data array length:', data.data?.length);
      if (data.data?.[0]) {
        console.log('- Has b64_json:', !!data.data[0].b64_json);
        console.log('- Has url:', !!data.data[0].url);
        console.log('- Revised prompt length:', data.data[0].revised_prompt?.length);
      }
    }
    
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

    if (isDev) {
      console.log('Successfully generated image');
      console.log('- Sent model:', model);
      console.log('- Sent size:', size);
      console.log('- Sent quality:', quality);
    }

    return NextResponse.json({ 
      imageUrl,
      revisedPrompt,
      sentPrompt: prompt,
      // Include metadata for debugging
      metadata: {
        model: model,
        size: size,
        quality: quality
      }
    });
  } catch (error) {
    console.error('Achievement image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
