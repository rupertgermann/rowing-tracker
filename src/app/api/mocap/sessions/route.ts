import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { initializePoseStreamBlob } from "@/lib/mocap/capturePersistence";

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
      durationSec: true,
      createdAt: true,
      capturePerspective: true,
      qualityScore: true,
      qualityFlags: true,
      _count: {
        select: {
          strokePostureMetrics: true,
          postureFaults: true,
        },
      },
    },
  });

  return NextResponse.json({ sessions: rows });
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
    source: z.enum(["browser"]),
    captureModelVersion: z.string().min(1).max(120),
    capturePerspective: z.enum(["side-left", "side-right"]),
    captureFps: z.number().positive().max(240),
    calibrationCatchFrame: CalibrationFrame.extend({
      pose: z.literal("catch"),
    }),
    calibrationFinishFrame: CalibrationFrame.extend({
      pose: z.literal("finish"),
    }),
  })
  .superRefine((body, ctx) => {
    for (const field of ["calibrationCatchFrame", "calibrationFinishFrame"] as const) {
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

  try {
    await initializePoseStreamBlob(storage, created.poseStreamPath, body.captureFps);
  } catch (err) {
    await prisma.mocapSession.delete({ where: { id: created.id } }).catch(() => {});
    return NextResponse.json(
      { error: "Failed to initialize pose stream blob", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: created.id,
    videoStoragePath: created.videoStoragePath,
    poseStreamPath: created.poseStreamPath,
    status: created.status,
    createdAt: created.createdAt,
  });
}
