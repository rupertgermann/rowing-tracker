// Achievement Generator Types

export interface GeneratedAchievement {
  awardId: string;
  title: string;
  description: string;
  earnedAt: Date;
  
  // Generated content
  story?: string;           // AI-generated narrative/story
  imageUrl?: string;        // Generated image URL (base64 data URL or external URL)
  imagePrompt?: string;     // The prompt used to generate the image
  
  // Generation metadata
  generatedAt?: Date;
  isGenerating?: boolean;
  error?: string;
}

export interface AchievementGeneratorSettings {
  storySystemPrompt: string;
  imagePrompt: string;
  imageStyle: 'realistic' | 'artistic' | 'minimalist' | 'vintage';
  imageSize: '1024x1024' | '1792x1024' | '1024x1792';
}

// Default prompts for achievement generation
export const DEFAULT_ACHIEVEMENT_STORY_PROMPT = `You are a creative writer crafting inspiring achievement stories for rowers. 
Your task is to write a short, motivational story (2-3 paragraphs) celebrating a rowing achievement.

The story should:
- Be personal and emotionally engaging
- Reference the specific achievement and what it represents
- Include vivid imagery related to rowing (water, oars, rhythm, power)
- End with an inspiring message about the journey ahead
- Be written in second person ("You have...")
- Be approximately 150-200 words

Achievement Details:
Title: {title}
Description: {description}
Earned On: {earnedAt}

Write the achievement story:`;

export const DEFAULT_ACHIEVEMENT_IMAGE_PROMPT = `Create a stunning, celebratory achievement certificate/card image for a rowing accomplishment.

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
