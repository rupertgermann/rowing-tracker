/**
 * Zod validation schemas for settings API
 */

import { z } from "zod";

// User Preferences
const themeSchema = z.enum(["light", "dark", "system"]);
const unitsSchema = z.enum(["metric", "imperial"]);
const dateFormatSchema = z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
const timeFormatSchema = z.enum(["12h", "24h"]);
const languageSchema = z.enum(["en", "es", "fr", "de"]);
const chartTypeSchema = z.enum(["line", "bar", "area"]);

// Training Settings
const weeklyGoalTypeSchema = z.enum(["sessions", "distance", "duration"]);
const preferredMetricSchema = z.enum(["pace", "power", "strokeRate", "heartRate"]);

// AI Settings - Use Case Config
const reasoningLevelSchema = z.enum(["none", "low", "medium", "high"]);
const verbosityLevelSchema = z.enum(["low", "medium", "high"]);
const modelSchema = z.enum(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"]);
const imageModelSchema = z.enum(["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"]);
const imageQualitySchema = z.enum(["auto", "high", "medium", "low"]);
const imageSizeSchema = z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const colorPaletteSchema = z.enum(["classic", "classic-red", "gold-blue", "emerald", "royal", "sunset", "monochrome", "ocean"]);

// Use case configuration object
const useCaseConfigSchema = z.object({
  reasoning: reasoningLevelSchema,
  verbosity: verbosityLevelSchema,
  model: modelSchema,
}).partial();

// Training zones schema
const trainingZoneSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
});

const trainingZonesSchema = z.object({
  zone1: trainingZoneSchema,
  zone2: trainingZoneSchema,
  zone3: trainingZoneSchema,
  zone4: trainingZoneSchema,
  zone5: trainingZoneSchema,
}).partial();

// AI Config schema (stored as JSON in DB)
const aiConfigSchema = z.object({
  chat: useCaseConfigSchema,
  insights: useCaseConfigSchema,
  trainingPlans: useCaseConfigSchema,
  awardSuggestions: useCaseConfigSchema,
  achievementText: useCaseConfigSchema,
  userProfileGeneration: useCaseConfigSchema,
  achievementImageModel: imageModelSchema,
  achievementImageQuality: imageQualitySchema,
  achievementImageSize: imageSizeSchema,
  achievementImageColors: colorPaletteSchema,
  systemPrompt: z.string(),
  chatSystemPrompt: z.string(),
  planGenerationPrompt: z.string(),
  insightsPrompt: z.string(),
  explainChartPrompt: z.string(),
  awardSuggestionsPrompt: z.string(),
  achievementStoryPrompt: z.string(),
  achievementImagePrompt: z.string(),
  userProfilePrompt: z.string(),
}).partial();

// Custom prompts AI schema (stored as JSON in DB)
const customPromptsAiSchema = z.record(z.string(), z.string());

// View settings schemas (flexible JSON objects)
const viewSettingsSchema = z.record(z.string(), z.unknown());

const postureThresholdSettingsSchema = z.object({
  version: z.string().min(1).max(20),
  userOverridden: z.boolean(),
  thresholds: z.object({
    rounded_back_at_catch: z.object({
      warningBelowDeg: z.number().min(0).max(180),
      criticalBelowDeg: z.number().min(0).max(180),
    }),
    early_arm_bend: z.object({
      infoBeforeLegsCompleteFrames: z.number().int().min(0).max(240),
      warningBeforeLegsCompleteFrames: z.number().int().min(0).max(240),
    }),
    back_opens_before_legs_drive: z.object({
      warningTorsoOpensBeforeLegsFrames: z.number().int().min(0).max(240),
    }),
    excessive_layback: z.object({
      infoAboveDeg: z.number().min(0).max(180),
      warningAboveDeg: z.number().min(0).max(180),
    }),
    slow_recovery_ratio: z.object({
      warningAboveRatio: z.number().min(0).max(20),
      criticalAboveRatio: z.number().min(0).max(20),
    }),
  }),
}).superRefine((value, ctx) => {
  const t = value.thresholds;
  if (
    t.rounded_back_at_catch.criticalBelowDeg >=
    t.rounded_back_at_catch.warningBelowDeg
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Rounded-back critical angle must be below warning angle',
      path: ['thresholds', 'rounded_back_at_catch', 'criticalBelowDeg'],
    });
  }
  if (
    t.early_arm_bend.infoBeforeLegsCompleteFrames >
    t.early_arm_bend.warningBeforeLegsCompleteFrames
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Early-arm-bend info frame count must be at or below warning',
      path: ['thresholds', 'early_arm_bend', 'infoBeforeLegsCompleteFrames'],
    });
  }
  if (t.excessive_layback.infoAboveDeg > t.excessive_layback.warningAboveDeg) {
    ctx.addIssue({
      code: 'custom',
      message: 'Excessive-layback info angle must be at or below warning',
      path: ['thresholds', 'excessive_layback', 'infoAboveDeg'],
    });
  }
  if (
    t.slow_recovery_ratio.warningAboveRatio >=
    t.slow_recovery_ratio.criticalAboveRatio
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Slow-recovery warning ratio must be below critical ratio',
      path: ['thresholds', 'slow_recovery_ratio', 'warningAboveRatio'],
    });
  }
});

/**
 * Main settings update schema
 * All fields are optional since the API accepts partial updates
 */
export const settingsUpdateSchema = z.object({
  // User preferences
  theme: themeSchema,
  units: unitsSchema,
  dateFormat: dateFormatSchema,
  timeFormat: timeFormatSchema,
  language: languageSchema,
  timeZone: z.string().max(100),
  defaultChartType: chartTypeSchema,
  animationsEnabled: z.boolean(),
  showPromptSuggestions: z.boolean(),
  customPrompts: z.array(z.string().max(500)).max(20),

  // Training settings
  trainingZones: trainingZonesSchema,
  preferredMetrics: z.array(preferredMetricSchema).max(10),
  weeklyGoalType: weeklyGoalTypeSchema,
  weeklyGoalTarget: z.number().int().min(1).max(100),
  restDayAlerts: z.boolean(),
  adaptationEnabled: z.boolean(),

  // Notification settings
  sessionReminders: z.boolean(),
  weeklyProgress: z.boolean(),
  achievementAlerts: z.boolean(),
  planReminders: z.boolean(),
  adherenceAlerts: z.boolean(),
  exportFormat: z.enum(['json', 'csv']).optional(),
  backupEnabled: z.boolean().optional(),
  lastBackup: z.string().optional().nullable(),

  // AI settings
  cloudAIEnabled: z.boolean(),
  maxTokens: z.number().int().min(100).max(128000),
  aiConfig: aiConfigSchema,
  customPromptsAi: customPromptsAiSchema,

  // Revision markers
  sessionsRevision: z.number().int().min(0),
  insightsRevision: z.number().int().min(0),

  // User profile context
  userProfileContext: z.string().max(50000).nullable(),
  userProfileRawInput: z.string().max(100000).nullable(),
  postureThresholds: postureThresholdSettingsSchema.nullable(),

  // View settings (flexible JSON)
  dashboardSettings: viewSettingsSchema,
  sessionsViewSettings: viewSettingsSchema,
  sessionAnalysisSettings: viewSettingsSchema,
  chartSettings: viewSettingsSchema,
  analyticsSettings: viewSettingsSchema,
}).partial().strict();

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
