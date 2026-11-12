import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  adaptPoseFrameStreamBlob,
  analyzePoseFrameStream,
  resolvePostureThresholdSettings,
  type CapturePerspective,
  type CsvStrokeTarget,
} from "@/lib/mocap/analysis";
import { decodeBrowserCalibration } from "./browserCalibration";
import type { MocapStorage } from "@/lib/mocap/storage";

export interface PersistedMocapAnalysisSummary {
  status?: "ready";
  strokeMetricCount: number;
  faultCount: number;
}

type AnalyzeSessionInput = {
  id: string;
  userId: string;
  poseStreamPath: string;
  capturePerspective: string;
  calibrationCatchFrame?: Prisma.JsonValue | null;
  calibrationFinishFrame?: Prisma.JsonValue | null;
};

export async function analyzeAndPersistMocapSession(
  storage: MocapStorage,
  session: AnalyzeSessionInput,
  unlinkRowingSessionId?: string,
): Promise<PersistedMocapAnalysisSummary> {
  const [poseBlob, userSettings] = await Promise.all([
    storage.read(session.poseStreamPath),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { postureThresholds: true },
    }),
  ]);

  const thresholds = resolvePostureThresholdSettings(
    userSettings?.postureThresholds,
  ).settings.thresholds;
  const stream = adaptPoseFrameStreamBlob(
    poseBlob,
    session.capturePerspective as CapturePerspective,
  );
  const result = analyzePoseFrameStream(stream, {
    thresholds,
    calibration: decodeBrowserCalibration(
      stream.capturePerspective,
      session.calibrationCatchFrame,
      session.calibrationFinishFrame,
    ),
  });

  await prisma.$transaction(async (tx) => {
    if (unlinkRowingSessionId) {
      await tx.$queryRaw`SELECT id FROM "RowingSession" WHERE id = ${unlinkRowingSessionId} FOR UPDATE`;
      const unlinked = await tx.mocapSession.updateMany({
        where: { id: session.id, userId: session.userId, status: "analyzing", rowingSessionId: unlinkRowingSessionId },
        data: { rowingSessionId: null, status: "ready" },
      });
      if (unlinked.count !== 1) throw new Error("Session changed during unlink analysis");
    }
    await tx.postureFault.deleteMany({
      where: { mocapSessionId: session.id },
    });
    await tx.strokePostureMetric.deleteMany({
      where: { mocapSessionId: session.id },
    });
    if (result.metrics.length > 0) {
      await tx.strokePostureMetric.createMany({
        data: result.metrics.map((metric) => ({
          mocapSessionId: session.id,
          strokeIndex: metric.strokeIndex,
          phaseBoundariesJson:
            metric.phaseBoundariesJson as unknown as Prisma.InputJsonValue,
          metricsJson: metric.metricsJson as unknown as Prisma.InputJsonValue,
          segmentationSource: metric.segmentationSource,
        })),
      });
    }
    if (result.faults.length > 0) {
      await tx.postureFault.createMany({
        data: result.faults.map((fault) => ({
          mocapSessionId: session.id,
          strokeIndex: fault.strokeIndex,
          faultType: fault.faultType,
          severity: fault.severity,
          phase: fault.phase,
          evidenceJson: fault.evidenceJson as unknown as Prisma.InputJsonValue,
        })),
      });
    }
  });

  return {
    ...(unlinkRowingSessionId ? { status: "ready" as const } : {}),
    strokeMetricCount: result.metrics.length,
    faultCount: result.faults.length,
  };
}

/**
 * Run analysis for a MocapSession that is linked to a RowingSession.
 * Recomputes metrics over aligned CSV catch windows; the finish remains pose-derived.
 * Incomplete/unmatched windows are omitted, never relabeled pose metrics.
 */
export async function analyzeAndPersistMocapSessionLinked(
  storage: MocapStorage,
  session: AnalyzeSessionInput,
  rowingSessionId: string,
): Promise<PersistedMocapAnalysisSummary> {
  const [poseBlob, userSettings] = await Promise.all([
    storage.read(session.poseStreamPath),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { postureThresholds: true },
    }),
  ]);

  const thresholds = resolvePostureThresholdSettings(
    userSettings?.postureThresholds,
  ).settings.thresholds;
  const stream = adaptPoseFrameStreamBlob(
    poseBlob,
    session.capturePerspective as CapturePerspective,
  );
  return prisma.$transaction(async (tx) => {
    // Rowing first, then capture: mutation guards and unlink publication use this order too.
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "RowingSession" WHERE id = ${rowingSessionId} AND "userId" = ${session.userId} FOR UPDATE`;
    if (rows.length !== 1) throw new Error("Rowing session no longer exists");
    const strokeDataRows = await tx.strokeData.findMany({
      where: { sessionId: rowingSessionId },
      orderBy: { strokeIndex: "asc" },
      select: { id: true, strokeIndex: true, time: true },
    });
    const csvStrokes: CsvStrokeTarget[] = strokeDataRows.map(sd => ({ id: sd.id, strokeIndex: sd.strokeIndex, timeMs: sd.time * 1000 }));
    const result = analyzePoseFrameStream(stream, {
      csvStrokes,
      thresholds,
      calibration: decodeBrowserCalibration(stream.capturePerspective, session.calibrationCatchFrame, session.calibrationFinishFrame),
    });
    if (result.metrics.length === 0) throw new Error("No complete CSV-aligned stroke windows with usable pose tracking");

    // Publish the link only with its recomputed rows; the lifecycle already claimed analyzing.
    const linked = await tx.mocapSession.updateMany({
      where: { id: session.id, userId: session.userId, status: "analyzing", OR: [{ rowingSessionId: null }, { rowingSessionId }] },
      data: { rowingSessionId, status: "ready" },
    });
    if (linked.count !== 1) throw new Error("Session changed during CSV analysis");
    await tx.postureFault.deleteMany({
      where: { mocapSessionId: session.id },
    });
    await tx.strokePostureMetric.deleteMany({
      where: { mocapSessionId: session.id },
    });
    if (result.metrics.length > 0) {
      await tx.strokePostureMetric.createMany({
        data: result.metrics.map((metric) => ({
          mocapSessionId: session.id,
          strokeIndex: metric.strokeIndex,
          phaseBoundariesJson: metric.phaseBoundariesJson as unknown as Prisma.InputJsonValue,
          metricsJson: metric.metricsJson as unknown as Prisma.InputJsonValue,
          segmentationSource: metric.segmentationSource,
          strokeDataId: metric.strokeDataId,
        })),
      });
    }
    if (result.faults.length > 0) {
      await tx.postureFault.createMany({
        data: result.faults.map((fault) => ({
          mocapSessionId: session.id,
          strokeIndex: fault.strokeIndex,
          faultType: fault.faultType,
          severity: fault.severity,
          phase: fault.phase,
          evidenceJson: fault.evidenceJson as unknown as Prisma.InputJsonValue,
        })),
      });
    }
    return {
      status: "ready" as const,
      strokeMetricCount: result.metrics.length,
      faultCount: result.faults.length,
    };
  }, { timeout: 30000 });
}
