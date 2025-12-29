import type { AISettings, UseCaseConfig } from '@/lib/settings';

export const AI_TEXT_MODEL_OPTIONS: Array<{ value: UseCaseConfig['model']; label: string }> = [
  { value: 'gpt-5.2', label: 'GPT-5.2 (Even more Capable)' },
  { value: 'gpt-5.1', label: 'GPT-5.1 (Most Capable)' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (Balanced)' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano (Fastest)' },
];

export const AI_REASONING_EFFORT_OPTIONS: Array<{ value: UseCaseConfig['reasoning']; label: string }> = [
  { value: 'none', label: 'None (Ultra-fast)' },
  { value: 'low', label: 'Low (Fast)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Quality)' },
];

export const AI_RESPONSE_VERBOSITY_OPTIONS: Array<{ value: UseCaseConfig['verbosity']; label: string }> = [
  { value: 'low', label: 'Low (Concise)' },
  { value: 'medium', label: 'Medium (Natural)' },
  { value: 'high', label: 'High (Detailed)' },
];

export const AI_ACHIEVEMENT_IMAGE_MODEL_OPTIONS: Array<{
  value: AISettings['achievementImageModel'];
  label: string;
}> = [
  { value: 'gpt-image-1', label: 'GPT Image 1 (Balanced)' },
  { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini (Fast)' },
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5 (Best Quality)' },
];

export const AI_ACHIEVEMENT_IMAGE_QUALITY_OPTIONS: Array<{
  value: AISettings['achievementImageQuality'];
  label: string;
}> = [
  { value: 'auto', label: 'Auto (default)' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const AI_ACHIEVEMENT_IMAGE_SIZE_OPTIONS: Array<{
  value: AISettings['achievementImageSize'];
  label: string;
}> = [
  { value: '1024x1024', label: '1024 x 1024' },
  { value: '1024x1536', label: '1024 x 1536' },
  { value: '1536x1024', label: '1536 x 1024' },
  { value: 'auto', label: 'Auto' },
];
