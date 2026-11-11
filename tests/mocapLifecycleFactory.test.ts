import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createPrismaMocapSessionLifecycle } from "../src/lib/mocap/lifecyclePrisma";
import type { MocapLifecycleSession } from "../src/lib/mocap/lifecycle";
import type { MocapStorage } from "../src/lib/mocap/storage";

const repoRoot = process.cwd();

test("lifecycle routes delegate dependencies to the Prisma factory", () => {
  for (const route of [
    "src/app/api/mocap/sessions/[id]/finalize/route.ts",
    "src/app/api/mocap/sessions/[id]/reanalyze/route.ts",
    "src/app/api/mocap/sessions/[id]/link/[rowingSessionId]/route.ts",
    "src/app/api/mocap/sessions/[id]/unlink/route.ts",
  ]) {
    const source = readFileSync(join(repoRoot, route), "utf8");

    assert.match(source, /getPrismaMocapSessionLifecycle/);
    assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(source, /@\/lib\/mocap\/storage/);
    assert.doesNotMatch(source, /@\/lib\/mocap\/sessionAnalysis/);
    assert.doesNotMatch(source, /finalizeMocapSessionLifecycle/);
    assert.doesNotMatch(source, /reanalyzeMocapSessionLifecycle/);
    assert.doesNotMatch(source, /linkMocapSessionLifecycle/);
    assert.doesNotMatch(source, /unlinkMocapSessionLifecycle/);
    assert.doesNotMatch(source, /\bprisma\./);
    assert.doesNotMatch(source, /\bgetMocapStorage\b/);
  }
});

test("Prisma lifecycle factory owns all verb wiring without throwing stubs", () => {
  const source = readFileSync(
    join(repoRoot, "src/lib/mocap/lifecyclePrisma.ts"),
    "utf8",
  );

  assert.match(source, /export function createPrismaMocapSessionLifecycle/);
  assert.match(source, /finalize\(userId, mocapSessionId, input\)/);
  assert.match(source, /reanalyze\(userId, mocapSessionId\)/);
  assert.match(source, /link\(userId, mocapSessionId, rowingSessionId\)/);
  assert.match(source, /unlink\(userId, mocapSessionId\)/);
  assert.match(source, /mocapLifecycleSessionSelect/);
  assert.match(source, /select: mocapLifecycleSessionSelect/);
  assert.match(source, /getMocapStorage\(\)/);
  assert.match(
    source,
    /options\.analyzePoseSegmented \?\? analyzeAndPersistMocapSession/,
  );
  assert.match(
    source,
    /options\.analyzeCsvAligned \?\? analyzeAndPersistMocapSessionLinked/,
  );
  assert.doesNotMatch(source, /throw new Error\(".*must use/);
});

test("factory drives finalize and reanalyze through injectable Prisma seams", async () => {
  const finalizeState = makeFactoryState({
    mocapSession: makeFactorySession({ status: "capturing" }),
  });
  const finalizeLifecycle = makeFactory(finalizeState);

  const finalized = await finalizeLifecycle.finalize("user-1", "mocap-1", {
    durationSec: 42,
    qualityScore: 0.91,
    qualityFlags: ["steady"],
  });

  assert.deepEqual(finalized, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    durationSec: 42,
    frameCount: 12,
    poseStreamBytes: 4096,
    strokeMetricCount: 3,
    faultCount: 1,
  });
  assert.equal(finalizeState.mocapSession.status, "ready");
  assert.equal(finalizeState.mocapSession.durationSec, 42);
  assert.equal(finalizeState.revisionBumps, 0);

  const reanalyzeState = makeFactoryState();
  const reanalyzeLifecycle = makeFactory(reanalyzeState);

  const reanalyzed = await reanalyzeLifecycle.reanalyze("user-1", "mocap-1");

  assert.deepEqual(reanalyzed, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    strokeMetricCount: 3,
    faultCount: 1,
  });
  assert.equal(reanalyzeState.mocapSession.status, "ready");
  assert.equal(reanalyzeState.revisionBumps, 0);
});

test("factory maps Prisma unique assignment conflicts to rowing-session conflicts", async () => {
  const state = makeFactoryState({ uniqueConflictOnAssign: true });
  const lifecycle = makeFactory(state);

  const result = await lifecycle.link("user-1", "mocap-1", "rowing-1");

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Rowing session is already linked to another mocap session.",
  });
  assert.equal(state.mocapSession.rowingSessionId, null);
  assert.equal(state.mocapSession.status, "ready");
  assert.equal(state.revisionBumps, 0);
});

test("factory preserves state when the link optimistic guard loses a race", async () => {
  const state = makeFactoryState({ lostAssignmentRace: true });
  const lifecycle = makeFactory(state);

  const result = await lifecycle.link("user-1", "mocap-1", "rowing-1");

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Mocap session is already linked to a rowing session. Unlink first.",
  });
  assert.equal(state.mocapSession.rowingSessionId, null);
  assert.equal(state.mocapSession.status, "ready");
  assert.equal(state.revisionBumps, 0);
});

test("factory rolls back link assignment when csv-aligned analysis fails", async () => {
  const state = makeFactoryState({ failCsvAnalysis: true });
  const lifecycle = makeFactory(state);

  const result = await lifecycle.link("user-1", "mocap-1", "rowing-1");

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "csv analysis failed",
  });
  assert.equal(state.mocapSession.rowingSessionId, null);
  assert.equal(state.mocapSession.status, "ready");
  assert.equal(state.revisionBumps, 0);
});

test("factory restores unlink assignment when pose-segmented analysis fails", async () => {
  const state = makeFactoryState({
    mocapSession: makeFactorySession({ rowingSessionId: "rowing-1" }),
    failPoseAnalysis: true,
  });
  const lifecycle = makeFactory(state);

  const result = await lifecycle.unlink("user-1", "mocap-1");

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "pose analysis failed",
  });
  assert.equal(state.mocapSession.rowingSessionId, "rowing-1");
  assert.equal(state.mocapSession.status, "ready");
  assert.equal(state.revisionBumps, 0);
});

test("factory bumps sessions revision once per successful link and unlink", async () => {
  const linkState = makeFactoryState();
  const linkLifecycle = makeFactory(linkState);

  const link = await linkLifecycle.link("user-1", "mocap-1", "rowing-1");

  assert.equal(link.ok, true);
  assert.equal(linkState.mocapSession.rowingSessionId, "rowing-1");
  assert.equal(linkState.mocapSession.status, "ready");
  assert.equal(linkState.revisionBumps, 1);

  const unlinkState = makeFactoryState({
    mocapSession: makeFactorySession({ rowingSessionId: "rowing-1" }),
  });
  const unlinkLifecycle = makeFactory(unlinkState);

  const unlink = await unlinkLifecycle.unlink("user-1", "mocap-1");

  assert.equal(unlink.ok, true);
  assert.equal(unlinkState.mocapSession.rowingSessionId, null);
  assert.equal(unlinkState.mocapSession.status, "ready");
  assert.equal(unlinkState.revisionBumps, 1);
});

type FakeMocapSession = MocapLifecycleSession & {
  durationSec: number;
  qualityScore: number | null;
  qualityFlags: string[];
};

interface FactoryState {
  mocapSession: FakeMocapSession;
  uniqueConflictOnAssign: boolean;
  lostAssignmentRace: boolean;
  failPoseAnalysis: boolean;
  failCsvAnalysis: boolean;
  revisionBumps: number;
}

function makeFactoryState(
  overrides: Partial<FactoryState> = {},
): FactoryState {
  return {
    mocapSession: makeFactorySession(),
    uniqueConflictOnAssign: false,
    lostAssignmentRace: false,
    failPoseAnalysis: false,
    failCsvAnalysis: false,
    revisionBumps: 0,
    ...overrides,
  };
}

function makeFactorySession(
  overrides: Partial<FakeMocapSession> = {},
): FakeMocapSession {
  return {
    id: "mocap-1",
    userId: "user-1",
    status: "ready",
    rowingSessionId: null,
    poseStreamPath: "mocap/user-1/mocap-1/pose-stream.bin",
    capturePerspective: "side-right",
    calibrationCatchFrame: null,
    calibrationFinishFrame: null,
    durationSec: 0,
    qualityScore: null,
    qualityFlags: [],
    ...overrides,
  };
}

function makeFactory(state: FactoryState) {
  return createPrismaMocapSessionLifecycle({
    prisma: makeFakePrisma(state),
    storage: makeFakeStorage(),
    analyzePoseSegmented: async () => {
      if (state.failPoseAnalysis) throw new Error("pose analysis failed");
      return { strokeMetricCount: 3, faultCount: 1 };
    },
    analyzeCsvAligned: async (_storage, _session, rowingSessionId) => {
      assert.equal(state.mocapSession.rowingSessionId, null);
      if (state.uniqueConflictOnAssign) throw Object.assign(new Error("unique constraint"), { code: "P2002" });
      if (state.failCsvAnalysis) throw new Error("csv analysis failed");
      state.mocapSession.rowingSessionId = rowingSessionId;
      return { strokeMetricCount: 4, faultCount: 2 };
    },
    finalizePoseStream: async () => ({
      frameCount: 12,
      poseStreamBytes: 4096,
    }),
    bumpSessionsRevision: async () => {
      state.revisionBumps++;
    },
  });
}

function makeFakePrisma(state: FactoryState) {
  return {
    mocapSession: {
      findFirst: async () => state.mocapSession,
      updateMany: async (args: {
        where: {
          id: string;
          userId?: string;
          rowingSessionId?: string | null;
          status?: string | { in: string[] };
        };
        data: Partial<FakeMocapSession>;
      }) => {
        if (state.uniqueConflictOnAssign && args.data.rowingSessionId) {
          const err = new Error("unique constraint") as Error & {
            code?: string;
          };
          err.code = "P2002";
          throw err;
        }
        if (
          state.lostAssignmentRace &&
          args.where.rowingSessionId === null &&
          args.data.status === "analyzing"
        ) {
          return { count: 0 };
        }
        if (!matchesMocapWhere(state.mocapSession, args.where)) {
          return { count: 0 };
        }
        Object.assign(state.mocapSession, args.data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        status: state.mocapSession.status,
        durationSec: state.mocapSession.durationSec,
      }),
      update: async (args: { data: Partial<FakeMocapSession> }) => {
        Object.assign(state.mocapSession, args.data);
        return state.mocapSession;
      },
    },
    rowingSession: {
      findFirst: async () => ({
        id: "rowing-1",
        mocapSession:
          state.mocapSession.rowingSessionId === "rowing-1"
            ? { id: state.mocapSession.id }
            : null,
      }),
    },
  };
}

function makeFakeStorage(): MocapStorage {
  return {
    videoPath: () => "video.webm",
    poseStreamPath: () => "pose-stream.bin",
    appendBytes: async () => {},
    writeAt: async () => {},
    read: async () => new Uint8Array(0),
    size: async () => 0,
    exists: async () => true,
    delete: async () => {},
  };
}

function matchesMocapWhere(
  session: FakeMocapSession,
  where: {
    id: string;
    userId?: string;
    rowingSessionId?: string | null;
    status?: string | { in: string[] };
  },
): boolean {
  if (where.id !== session.id) return false;
  if (where.userId !== undefined && where.userId !== session.userId) {
    return false;
  }
  if (
    "rowingSessionId" in where &&
    where.rowingSessionId !== session.rowingSessionId
  ) {
    return false;
  }
  if (typeof where.status === "string") return where.status === session.status;
  if (where.status) return where.status.in.includes(session.status);
  return true;
}
