// Achievement Generator Types

export interface GeneratedAchievement {
  awardId: string;
  title: string;
  description: string;
  earnedAt: Date;
  
  // Generated content
  story?: string;           // AI-generated narrative/story
  imageUrl?: string;        // File path to image in public/assets/awards/ (e.g., /assets/awards/award_id.png)
  imagePrompt?: string;     // The prompt used to generate the image
  hasImage?: boolean;       // Flag indicating image exists on filesystem
  imageVersion?: number;    // Cache-busting version number, incremented on regeneration
  
  // Generation metadata
  generatedAt?: Date;
  isGenerating?: boolean;
  error?: string;
}

export interface AchievementGeneratorSettings {
  storySystemPrompt: string;
  imagePrompt: string;
  imageStyle: 'realistic' | 'artistic' | 'minimalist' | 'vintage';
  imageSize: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
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
- (colors)
- Include decorative elements suggesting achievement (laurels, ribbons, stars)
- The image should feel prestigious and celebratory
- Do NOT include any text - the text will be overlaid separately
- High quality, suitable for display`;
