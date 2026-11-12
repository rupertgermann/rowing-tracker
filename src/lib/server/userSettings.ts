import { z } from "zod";
import { ACHIEVEMENT_AI_DEFAULTS, normalizeAITextModel } from "@/lib/settings";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const USER_SETTINGS_DEFAULT_VALUES = {
  theme: "system",
  units: "metric",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "24h",
  language: "en",
  defaultChartType: "line",
  animationsEnabled: true,
  cloudAIEnabled: false,
  maxTokens: 4000,
} as const satisfies Pick<
  Prisma.UserSettingsUncheckedCreateInput,
  | "theme"
  | "units"
  | "dateFormat"
  | "timeFormat"
  | "language"
  | "defaultChartType"
  | "animationsEnabled"
  | "cloudAIEnabled"
  | "maxTokens"
>;

type UserSettingsCreateOverrides = Omit<
  Partial<Prisma.UserSettingsUncheckedCreateInput>,
  "userId"
>;

export function buildUserSettingsCreateData(
  userId: string,
  overrides: UserSettingsCreateOverrides = {},
) {
  return {
    userId,
    ...USER_SETTINGS_DEFAULT_VALUES,
    ...overrides,
  };
}

export async function bumpUserSessionsRevision(
  userId: string,
  db: Pick<Prisma.TransactionClient, "userSettings"> = prisma,
): Promise<void> {
  await db.userSettings.upsert({
    where: { userId },
    update: {
      sessionsRevision: { increment: 1 },
    },
    create: buildUserSettingsCreateData(userId, {
      sessionsRevision: 1,
    }),
  });
}

export async function getUserAchievementAISettings(
  userId: string,
  useCase: keyof typeof ACHIEVEMENT_AI_DEFAULTS,
) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { aiConfig: true, maxTokens: true },
  });
  const defaults = ACHIEVEMENT_AI_DEFAULTS[useCase];
  const aiConfig = settings?.aiConfig;
  const saved = aiConfig && typeof aiConfig === "object" && !Array.isArray(aiConfig)
    ? aiConfig[useCase] : undefined;
  // Legacy or partial records retain valid fields and default each missing/invalid field.
  const config = z.object({
    model: z.string().nullish().catch(undefined).transform(model => normalizeAITextModel(model, defaults.model)),
    reasoning: z.enum(["none", "low", "medium", "high"]).catch(defaults.reasoning),
    verbosity: z.enum(["low", "medium", "high"]).catch(defaults.verbosity),
  }).catch(defaults).parse(saved);
  return { config, maxTokens: settings?.maxTokens ?? USER_SETTINGS_DEFAULT_VALUES.maxTokens };
}
