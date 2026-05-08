import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { analyzeAndPersistMocapSessionLinked } from "@/lib/mocap/sessionAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowingSessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, rowingSessionId } = await params;
  const userId = session.user.id;

  // Validate: MocapSession belongs to user and is "ready"
  const mocapSession = await prisma.mocapSession.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      rowingSessionId: true,
      poseStreamPath: true,
      capturePerspective: true,
      calibrationCatchFrame: true,
      calibrationFinishFrame: true,
    },
  });

  if (!mocapSession) {
    return NextResponse.json({ error: "Mocap session not found" }, { status: 404 });
  }

  if (mocapSession.status !== "ready") {
    return NextResponse.json(
      { error: `Mocap session not ready (status=${mocapSession.status})` },
      { status: 409 },
    );
  }

  // Enforce 1:1 — reject if mocap session already linked
  if (mocapSession.rowingSessionId !== null) {
    return NextResponse.json(
      { error: "Mocap session is already linked to a rowing session. Unlink first." },
      { status: 409 },
    );
  }

  // Validate: RowingSession belongs to user
  const rowingSession = await prisma.rowingSession.findFirst({
    where: { id: rowingSessionId, userId },
    select: {
      id: true,
      mocapSession: { select: { id: true } },
    },
  });

  if (!rowingSession) {
    return NextResponse.json({ error: "Rowing session not found" }, { status: 404 });
  }

  // Enforce 1:1 — reject if rowing session already linked to another MocapSession
  if (rowingSession.mocapSession !== null) {
    return NextResponse.json(
      { error: "Rowing session is already linked to another mocap session." },
      { status: 409 },
    );
  }

  // Atomically create the link and set status to "analyzing"
  await prisma.mocapSession.update({
    where: { id },
    data: { rowingSessionId, status: "analyzing" },
  });

  const storage = getMocapStorage();

  try {
    await analyzeAndPersistMocapSessionLinked(storage, mocapSession, rowingSessionId);
  } catch (err) {
    // Roll back: clear the link and revert status
    await prisma.mocapSession.update({
      where: { id },
      data: { rowingSessionId: null, status: "ready" },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const updated = await prisma.mocapSession.update({
    where: { id },
    data: { status: "ready" },
    select: { id: true, rowingSessionId: true, status: true },
  });

  return NextResponse.json({
    id: updated.id,
    rowingSessionId: updated.rowingSessionId,
    status: updated.status,
  });
}
