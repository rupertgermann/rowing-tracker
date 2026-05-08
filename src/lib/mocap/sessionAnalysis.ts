import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  adaptPoseFrameStreamBlob,
  analyzePoseFrameStream,
  resolvePostureThresholdSettings,
  type CapturePerspective,
} from "@/lib/mocap/analysis";
import type { MocapStorage } from "@/lib/mocap/storage";

export interface PersistedMocapAnalysisSummary {
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
  const result = analyzePoseFrameStream(stream, { thresholds });

  await prisma.$transaction(async (tx) => {
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
    strokeMetricCount: result.metrics.length,
    faultCount: result.faults.length,
  };
}

/**
 * Run analysis for a MocapSession that is linked to a RowingSession.
 * Fetches StrokeData rows for the linked rowing session and aligns
 * pose-derived strokes to them by index order (simple cross-correlation v1).
 * Sets segmentationSource = "csv-aligned" and strokeDataId on each metric row.
 */
export async function analyzeAndPersistMocapSessionLinked(
  storage: MocapStorage,
  session: AnalyzeSessionInput,
  rowingSessionId: string,
): Promise<PersistedMocapAnalysisSummary> {
  const [poseBlob, userSettings, strokeDataRows] = await Promise.all([
    storage.read(session.poseStreamPath),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { postureThresholds: true },
    }),
    prisma.strokeData.findMany({
      where: { sessionId: rowingSessionId },
      orderBy: { strokeIndex: "asc" },
      select: { id: true, strokeIndex: true },
    }),
  ]);

  const thresholds = resolvePostureThresholdSettings(
    userSettings?.postureThresholds,
  ).settings.thresholds;
  const stream = adaptPoseFrameStreamBlob(
    poseBlob,
    session.capturePerspective as CapturePerspective,
  );
  const result = analyzePoseFrameStream(stream, { thresholds });

  // Build an index map: position (0-based array index) → StrokeData id
  const strokeDataIdByPosition = new Map<number, string>();
  strokeDataRows.forEach((sd, pos) => {
    strokeDataIdByPosition.set(pos, sd.id);
  });

  await prisma.$transaction(async (tx) => {
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
          segmentationSource: "csv-aligned",
          strokeDataId: strokeDataIdByPosition.get(metric.strokeIndex) ?? null,
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
    strokeMetricCount: result.metrics.length,
    faultCount: result.faults.length,
  };
}
