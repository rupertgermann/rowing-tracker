import type { UseCaseConfig } from '@/lib/settings';

export const AI_TEXT_MODEL_OPTIONS: Array<{ value: UseCaseConfig['model']; label: string }> = [
  { value: 'gpt-5-nano', label: 'GPT-5 Nano (Fastest)' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (Balanced)' },
  { value: 'gpt-5.1', label: 'GPT-5.1 (Most Capable)' },
  { value: 'gpt-5.2', label: 'GPT-5.2 (Even more Capable)' },
];
