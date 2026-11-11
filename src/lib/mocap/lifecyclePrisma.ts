import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  finalizeMocapSessionLifecycle,
  linkMocapSessionLifecycle,
  reanalyzeMocapSessionLifecycle,
  unlinkMocapSessionLifecycle,
  type FinalizeMocapSessionInput,
  type FinalizeMocapSessionResult,
  type LinkMocapSessionResult,
  type MocapCaptureFinalizationState,
  type MocapLifecycleRowingSession,
  type MocapLifecycleSession,
  type ReanalyzeMocapSessionInput,
  type ReanalyzeMocapSessionDependencies,
  type ReanalyzeMocapSessionResult,
  type UnlinkMocapSessionResult,
} from "@/lib/mocap/lifecycle";
import { finalizePoseStreamBlob } from "@/lib/mocap/capturePersistence";
import { getMocapStorage } from "@/lib/mocap/storage";
import type { MocapStorage } from "@/lib/mocap/storage";
import {
  analyzeAndPersistMocapSession,
  analyzeAndPersistMocapSessionLinked,
} from "@/lib/mocap/sessionAnalysis";
import { bumpUserSessionsRevision } from "@/lib/server/userSettings";

type MocapStatus = "capturing" | "analyzing" | "ready";
type StatusTransition = { from: string | string[] };
type SessionStatusUpdate = Partial<
  Omit<MocapCaptureFinalizationState, "status"> & {
    rowingSessionId: string | null;
    status: MocapStatus;
  }
>;

interface MocapLifecyclePrismaClient {
  mocapSession: {
    findFirst(args: {
      where: { id: string; userId: string };
      select: typeof mocapLifecycleSessionSelect;
    }): Promise<MocapLifecycleSession | null>;
    updateMany(args: {
      where: {
        id: string;
        userId?: string;
        rowingSessionId?: string | null;
        status?: string | { in: string[] };
      };
      data: SessionStatusUpdate;
    }): Promise<{ count: number }>;
    findUniqueOrThrow(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<{ status: string; durationSec?: number }>;
    update(args: {
      where: { id: string };
      data: SessionStatusUpdate;
      select?: Record<string, boolean>;
    }): Promise<unknown>;
  };
  rowingSession: {
    findFirst(args: {
      where: { id: string; userId: string };
      select: { id: true; mocapSession: { select: { id: true } } };
    }): Promise<MocapLifecycleRowingSession | null>;
  };
}

type FinalizeVerbInput = Omit<
  FinalizeMocapSessionInput,
  keyof ReanalyzeMocapSessionInput
>;

export interface CreatePrismaMocapSessionLifecycleOptions {
  prisma?: MocapLifecyclePrismaClient;
  storage?: MocapStorage;
  finalizePoseStream?: typeof finalizePoseStreamBlob;
  analyzePoseSegmented?: typeof analyzeAndPersistMocapSession;
  analyzeCsvAligned?: typeof analyzeAndPersistMocapSessionLinked;
  bumpSessionsRevision?: (userId: string) => Promise<void>;
}

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
  finalize(
    userId: string,
    mocapSessionId: string,
    input: FinalizeVerbInput,
  ): Promise<FinalizeMocapSessionResult>;
  link(
    userId: string,
    mocapSessionId: string,
    rowingSessionId: string,
  ): Promise<LinkMocapSessionResult>;
  unlink(
    userId: string,
    mocapSessionId: string,
  ): Promise<UnlinkMocapSessionResult>;
}

export function createPrismaMocapSessionLifecycle(
  options: CreatePrismaMocapSessionLifecycleOptions = {},
): MocapSessionLifecycle {
  const db = (options.prisma ?? prisma) as MocapLifecyclePrismaClient;
  const storage = options.storage ?? getMocapStorage();
  const setStatus = createSetMocapSessionStatus(db);
  const setCaptureFinalizationState =
    createSetMocapCaptureFinalizationState(db);
  const finalizePoseStream =
    options.finalizePoseStream ?? finalizePoseStreamBlob;
  const analyzePoseSegmented =
    options.analyzePoseSegmented ?? analyzeAndPersistMocapSession;
  const analyzeCsvAligned =
    options.analyzeCsvAligned ?? analyzeAndPersistMocapSessionLinked;
  const bumpSessionsRevision =
    options.bumpSessionsRevision ?? bumpUserSessionsRevision;
  const findSession = (userId: string, mocapSessionId: string) =>
    db.mocapSession.findFirst({
      where: { id: mocapSessionId, userId },
      select: mocapLifecycleSessionSelect,
    });
  const reanalyzeDeps: ReanalyzeMocapSessionDependencies = {
    storage,
    findSession,
    setStatus,
    analyzePoseSegmented,
    analyzeCsvAligned,
  };

  return {
    reanalyze(userId, mocapSessionId) {
      return reanalyzeMocapSessionLifecycle(reanalyzeDeps, {
        userId,
        mocapSessionId,
      });
    },
    finalize(userId, mocapSessionId, input) {
      return finalizeMocapSessionLifecycle(
        {
          storage,
          findSession,
          setStatus,
          setCaptureFinalizationState,
          finalizePoseStream,
          analyzePoseSegmented,
        },
        {
          userId,
          mocapSessionId,
          ...input,
        },
      );
    },
    link(userId, mocapSessionId, rowingSessionId) {
      return linkMocapSessionLifecycle(
        {
          storage,
          findSession,
          findRowingSession: (ownerId, targetRowingSessionId) =>
            db.rowingSession.findFirst({
              where: { id: targetRowingSessionId, userId: ownerId },
              select: {
                id: true,
                mocapSession: { select: { id: true } },
              },
            }),
          setStatus,
          assignMocapSession: async (
            targetMocapSessionId,
            ownerId,
          ) => {
            try {
              const update = await db.mocapSession.updateMany({
                where: {
                  id: targetMocapSessionId,
                  userId: ownerId,
                  rowingSessionId: null,
                  status: "ready",
                },
                data: {
                  status: "analyzing",
                },
              });
              return update.count === 1 ? "assigned" : "mocap-conflict";
            } catch (err) {
              if ((err as { code?: string })?.code === "P2002") {
                return "rowing-conflict";
              }
              throw err;
            }
          },
          restoreMocapSessionAssignment: (
            targetMocapSessionId,
            restoredRowingSessionId,
            status,
          ) =>
            db.mocapSession
              .update({
                where: { id: targetMocapSessionId },
                data: { rowingSessionId: restoredRowingSessionId, status },
              })
              .then(() => undefined),
          bumpSessionsRevision,
          analyzeCsvAligned,
        },
        { userId, mocapSessionId, rowingSessionId },
      );
    },
    unlink(userId, mocapSessionId) {
      return unlinkMocapSessionLifecycle(
        {
          storage,
          findSession,
          setStatus,
          unassignMocapSession: async (
            targetMocapSessionId,
            ownerId,
            rowingSessionId,
          ) => {
            const update = await db.mocapSession.updateMany({
              where: {
                id: targetMocapSessionId,
                userId: ownerId,
                rowingSessionId,
                status: "ready",
              },
              data: { rowingSessionId: null, status: "analyzing" },
            });
            return update.count === 1;
          },
          restoreMocapSessionAssignment: (
            targetMocapSessionId,
            restoredRowingSessionId,
            status,
          ) =>
            db.mocapSession
              .update({
                where: { id: targetMocapSessionId },
                data: { rowingSessionId: restoredRowingSessionId, status },
              })
              .then(() => undefined),
          bumpSessionsRevision,
          analyzePoseSegmented,
        },
        { userId, mocapSessionId },
      );
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
  return createSetMocapSessionStatus(
    prisma as unknown as MocapLifecyclePrismaClient,
  )(mocapSessionId, status, transition);
}

function createSetMocapSessionStatus(db: MocapLifecyclePrismaClient) {
  return async (
    mocapSessionId: string,
    status: MocapStatus,
    transition?: StatusTransition,
  ): Promise<{ status: string } | null> => {
    if (transition) {
      const updated = await db.mocapSession.updateMany({
        where: transitionStatusWhere(mocapSessionId, transition),
        data: { status },
      });
      if (updated.count !== 1) return null;
      return db.mocapSession.findUniqueOrThrow({
        where: { id: mocapSessionId },
        select: { status: true },
      });
    }

    const row = await db.mocapSession.update({
      where: { id: mocapSessionId },
      data: { status },
      select: { status: true },
    });
    return row as { status: string };
  };
}

export async function setMocapCaptureFinalizationState(
  mocapSessionId: string,
  state: MocapCaptureFinalizationState,
  transition?: StatusTransition,
): Promise<{ status: string; durationSec: number } | null> {
  return createSetMocapCaptureFinalizationState(
    prisma as unknown as MocapLifecyclePrismaClient,
  )(mocapSessionId, state, transition);
}

function createSetMocapCaptureFinalizationState(
  db: MocapLifecyclePrismaClient,
) {
  return async (
    mocapSessionId: string,
    state: MocapCaptureFinalizationState,
    transition?: StatusTransition,
  ): Promise<{ status: string; durationSec: number } | null> => {
    if (transition) {
      const updated = await db.mocapSession.updateMany({
        where: transitionStatusWhere(mocapSessionId, transition),
        data: state,
      });
      if (updated.count !== 1) return null;
      const row = await db.mocapSession.findUniqueOrThrow({
        where: { id: mocapSessionId },
        select: { status: true, durationSec: true },
      });
      return { status: row.status, durationSec: row.durationSec ?? 0 };
    }

    const row = await db.mocapSession.update({
      where: { id: mocapSessionId },
      data: state,
      select: { status: true, durationSec: true },
    });
    const record = row as { status: string; durationSec?: number };
    return { status: record.status, durationSec: record.durationSec ?? 0 };
  };
}
