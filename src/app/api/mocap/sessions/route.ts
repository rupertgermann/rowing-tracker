import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { initializePoseStreamBlob } from "@/lib/mocap/capturePersistence";
import { getMocapListAssignmentState } from "@/lib/mocap/assignment";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.mocapSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      rowingSessionId: true,
      durationSec: true,
      createdAt: true,
      capturePerspective: true,
      qualityScore: true,
      qualityFlags: true,
      rowingSession: {
        select: {
          id: true,
          timestamp: true,
          distance: true,
          duration: true,
          avgPower: true,
        },
      },
      _count: {
        select: {
          strokePostureMetrics: true,
          postureFaults: true,
        },
      },
    },
  });

  return NextResponse.json({
    sessions: rows.map((row) => ({
      ...row,
      assignmentState: getMocapListAssignmentState(row),
    })),
  });
}

const CalibrationFrame = z.object({
  pose: z.enum(["catch", "finish"]),
  capturedAt: z.string().datetime(),
  capturePerspective: z.enum(["side-left", "side-right"]),
  videoWidth: z.number().int().nonnegative(),
  videoHeight: z.number().int().nonnegative(),
  meanKeypointConfidence: z.number().min(0).max(1),
  trackedKeypointCount: z.number().int().nonnegative().max(33),
  qualityFlags: z.number().int().nonnegative(),
  poseFrameBase64: z.string().min(1),
});

const CreateBody = z
  .object({
    source: z.enum(["browser", "sidecar"]),
    captureModelVersion: z.string().min(1).max(120),
    capturePerspective: z.enum(["side-left", "side-right", "sidecar-3d"]),
    captureFps: z.number().positive().max(240),
    recordOnly: z.boolean().optional(),
    calibrationId: z.string().uuid().optional(),
    cameraCount: z.number().int().positive().max(16).optional(),
    calibrationCatchFrame: CalibrationFrame.extend({
      pose: z.literal("catch"),
    }).optional(),
    calibrationFinishFrame: CalibrationFrame.extend({
      pose: z.literal("finish"),
    }).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.source === "sidecar") return; // sidecar sessions have no browser calibration frames
    for (const field of ["calibrationCatchFrame", "calibrationFinishFrame"] as const) {
      if (body.recordOnly && body[field] === undefined) continue;
      if (!body[field]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Calibration frame is required unless recordOnly is true",
        });
        continue;
      }
      if (body[field].capturePerspective !== body.capturePerspective) {
        ctx.addIssue({
          code: "custom",
          path: [field, "capturePerspective"],
          message: "Calibration perspective must match capturePerspective",
        });
      }
    }
  });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const storage = getMocapStorage();
  const recordOnly = body.recordOnly === true || body.source === "sidecar";

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.mocapSession.create({
      data: {
        userId,
        source: body.source,
        captureModelVersion: body.captureModelVersion,
        capturePerspective: body.capturePerspective,
        captureFps: body.captureFps,
        calibrationCatchFrame: body.calibrationCatchFrame,
        calibrationFinishFrame: body.calibrationFinishFrame,
        calibrationId: body.calibrationId,
        cameraCount: body.cameraCount,
        videoStoragePath: "pending",
        poseStreamPath: "pending",
        status: "capturing",
      },
    });
    const videoStoragePath = storage.videoPath(userId, row.id);
    const poseStreamPath = storage.poseStreamPath(userId, row.id);
    return tx.mocapSession.update({
      where: { id: row.id },
      data: { videoStoragePath, poseStreamPath },
    });
  });

  if (!recordOnly) {
    try {
      await initializePoseStreamBlob(storage, created.poseStreamPath, body.captureFps);
    } catch (err) {
      await prisma.mocapSession.delete({ where: { id: created.id } }).catch(() => {});
      return NextResponse.json(
        { error: "Failed to initialize pose stream blob", details: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    id: created.id,
    videoStoragePath: created.videoStoragePath,
    poseStreamPath: created.poseStreamPath,
    status: created.status,
    createdAt: created.createdAt,
  });
}
