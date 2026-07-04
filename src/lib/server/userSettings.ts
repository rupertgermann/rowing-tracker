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

export async function bumpUserSessionsRevision(userId: string): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      sessionsRevision: { increment: 1 },
    },
    create: buildUserSettingsCreateData(userId, {
      sessionsRevision: 1,
    }),
  });
}
