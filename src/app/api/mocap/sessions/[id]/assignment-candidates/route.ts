import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  buildManualAssignmentCandidates,
  getMocapLinkability,
} from "@/lib/mocap/assignment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const mocapSession = await prisma.mocapSession.findFirst({
    where: { id, userId },
    select: {
      id: true,
      status: true,
      rowingSessionId: true,
      createdAt: true,
      durationSec: true,
      qualityFlags: true,
    },
  });

  if (!mocapSession) {
    return NextResponse.json(
      {
        linkable: false,
        reason: "not_found",
        message: "Mocap session not found",
        candidates: [],
      },
      { status: 404 },
    );
  }

  const linkability = getMocapLinkability(mocapSession);
  if (!linkability.linkable) {
    return NextResponse.json({
      linkable: false,
      reason: linkability.reason,
      message: linkability.message,
      candidates: [],
    });
  }

  const rowingSessions = await prisma.rowingSession.findMany({
    where: {
      userId,
      mocapSession: { is: null },
    },
    select: {
      id: true,
      timestamp: true,
      distance: true,
      duration: true,
      avgPower: true,
      strokeCount: true,
      sourceFile: true,
      mocapSession: {
        select: { id: true },
      },
    },
  });

  return NextResponse.json({
    linkable: true,
    mocapSession: {
      id: mocapSession.id,
      createdAt: mocapSession.createdAt,
      durationSec: mocapSession.durationSec,
    },
    candidates: buildManualAssignmentCandidates(mocapSession, rowingSessions),
  });
}
