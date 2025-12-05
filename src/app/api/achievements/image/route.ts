import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, customPrompt, apiKey, size = '1024x1024' } = body;

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

    // Build the image prompt
    const defaultPrompt = `Create a stunning, celebratory achievement certificate/card image for a rowing accomplishment.

Achievement: {title}
Description: {description}

Style guidelines:
- Modern, clean design with elegant typography
- Incorporate rowing imagery (stylized oars, water ripples, rowing silhouette)
- Use a color palette of deep blues, golds, and whites
- Include decorative elements suggesting achievement (laurels, ribbons, stars)
- The image should feel prestigious and celebratory
- Do NOT include any text - the text will be overlaid separately
- Aspect ratio: square (1:1)
- High quality, suitable for display`;

    const prompt = (customPrompt || defaultPrompt)
      .replace('{title}', title)
      .replace('{description}', description);

    // Call OpenAI DALL-E API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI DALL-E API error:', errorText);
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
      revisedPrompt 
    });
  } catch (error) {
    console.error('Achievement image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
