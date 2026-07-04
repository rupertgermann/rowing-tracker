import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  reanalyzeMocapSessionLifecycle,
  type MocapCaptureFinalizationState,
  type ReanalyzeMocapSessionDependencies,
  type ReanalyzeMocapSessionResult,
} from "@/lib/mocap/lifecycle";
import { getMocapStorage } from "@/lib/mocap/storage";
import {
  analyzeAndPersistMocapSession,
  analyzeAndPersistMocapSessionLinked,
} from "@/lib/mocap/sessionAnalysis";

type MocapStatus = "capturing" | "analyzing" | "ready";
type StatusTransition = { from: string | string[] };

export const mocapLifecycleSessionSelect = {
  id: true,
  userId: true,
  status: true,
  rowingSessionId: true,
  poseStreamPath: true,
  capturePerspective: true,
  calibrationCatchFrame: true,
  calibrationFinishFrame: true,
} satisfies Prisma.MocapSessionSelect;

export interface MocapSessionLifecycle {
  reanalyze(
    userId: string,
    mocapSessionId: string,
  ): Promise<ReanalyzeMocapSessionResult>;
}

export function createPrismaMocapSessionLifecycle(): MocapSessionLifecycle {
  const storage = getMocapStorage();
  const reanalyzeDeps: ReanalyzeMocapSessionDependencies = {
    storage,
    findSession: (userId, mocapSessionId) =>
      prisma.mocapSession.findFirst({
        where: { id: mocapSessionId, userId },
        select: mocapLifecycleSessionSelect,
      }),
    setStatus: setMocapSessionStatus,
    analyzePoseSegmented: analyzeAndPersistMocapSession,
    analyzeCsvAligned: analyzeAndPersistMocapSessionLinked,
  };

  return {
    reanalyze(userId, mocapSessionId) {
      return reanalyzeMocapSessionLifecycle(reanalyzeDeps, {
        userId,
        mocapSessionId,
      });
    },
  };
}

let prismaMocapSessionLifecycle: MocapSessionLifecycle | null = null;

export function getPrismaMocapSessionLifecycle(): MocapSessionLifecycle {
  prismaMocapSessionLifecycle ??= createPrismaMocapSessionLifecycle();
  return prismaMocapSessionLifecycle;
}

function transitionStatusWhere(
  mocapSessionId: string,
  transition?: StatusTransition,
): { id: string; status?: string | { in: string[] } } {
  if (!transition) return { id: mocapSessionId };
  return {
    id: mocapSessionId,
    status: Array.isArray(transition.from)
      ? { in: transition.from }
      : transition.from,
  };
}

export async function setMocapSessionStatus(
  mocapSessionId: string,
  status: MocapStatus,
  transition?: StatusTransition,
): Promise<{ status: string } | null> {
  if (transition) {
    const updated = await prisma.mocapSession.updateMany({
      where: transitionStatusWhere(mocapSessionId, transition),
      data: { status },
    });
    if (updated.count !== 1) return null;
    return prisma.mocapSession.findUniqueOrThrow({
      where: { id: mocapSessionId },
      select: { status: true },
    });
  }

  return prisma.mocapSession.update({
    where: { id: mocapSessionId },
    data: { status },
    select: { status: true },
  });
}

export async function setMocapCaptureFinalizationState(
  mocapSessionId: string,
  state: MocapCaptureFinalizationState,
  transition?: StatusTransition,
): Promise<{ status: string; durationSec: number } | null> {
  if (transition) {
    const updated = await prisma.mocapSession.updateMany({
      where: transitionStatusWhere(mocapSessionId, transition),
      data: state,
    });
    if (updated.count !== 1) return null;
    return prisma.mocapSession.findUniqueOrThrow({
      where: { id: mocapSessionId },
      select: { status: true, durationSec: true },
    });
  }

  return prisma.mocapSession.update({
    where: { id: mocapSessionId },
    data: state,
    select: { status: true, durationSec: true },
  });
}
