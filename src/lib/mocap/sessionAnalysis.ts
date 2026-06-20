import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  adaptPoseFrameStreamBlob,
  analyzePoseFrameStream,
  resolvePostureThresholdSettings,
  alignStrokesToCsv,
  type CapturePerspective,
  type CsvStrokeTarget,
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
 * Aligns pose-derived strokes to StrokeData rows by timestamp cross-correlation
 * rather than array position. Sets segmentationSource = "csv-aligned" and
 * strokeDataId on each metric row. Unmatched pose strokes get strokeDataId=null
 * and csvMatchOffsetMs=null in phaseBoundariesJson.
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
      select: { id: true, strokeIndex: true, time: true },
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

  // Build CSV stroke targets with elapsed ms for alignment
  const csvStrokes: CsvStrokeTarget[] = strokeDataRows.map((sd) => ({
    id: sd.id,
    strokeIndex: sd.strokeIndex,
    timeMs: sd.time * 1000, // StrokeData.time is elapsed seconds from session start
  }));

  // Extract pose catch timestamps (elapsed ms from pose session start)
  const poseCatchTimesMs = result.metrics.map(
    (m) => stream.frames[m.phaseBoundariesJson.catchFrameIndex]?.timestampMs ?? 0,
  );

  const alignment = alignStrokesToCsv(poseCatchTimesMs, csvStrokes);

  await prisma.$transaction(async (tx) => {
    await tx.postureFault.deleteMany({
      where: { mocapSessionId: session.id },
    });
    await tx.strokePostureMetric.deleteMany({
      where: { mocapSessionId: session.id },
    });
    if (result.metrics.length > 0) {
      await tx.strokePostureMetric.createMany({
        data: result.metrics.map((metric) => {
          const match = alignment.matches.get(metric.strokeIndex);
          const phaseBoundariesJson = {
            ...metric.phaseBoundariesJson,
            csvMatchOffsetMs: match ? match.offsetMs : null,
          };
          return {
            mocapSessionId: session.id,
            strokeIndex: metric.strokeIndex,
            phaseBoundariesJson: phaseBoundariesJson as unknown as Prisma.InputJsonValue,
            metricsJson: metric.metricsJson as unknown as Prisma.InputJsonValue,
            segmentationSource: "csv-aligned",
            strokeDataId: match?.csvStrokeDataId ?? null,
          };
        }),
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
