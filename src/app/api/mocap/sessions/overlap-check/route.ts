import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/mocap/sessions/overlap-check
 * Given a list of newly-imported RowingSession ids, find any existing
 * MocapSessions (unlinked) whose capture window overlaps the rowing
 * session's timestamp by ±2 minutes.
 *
 * Body: { rowingSessionIds: string[] }
 * Response: { overlaps: Array<{ rowingSessionId: string; mocapSessionId: string }> }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const OVERLAP_MARGIN_MS = 2 * 60 * 1000; // ±2 minutes

  let rowingSessionIds: string[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.rowingSessionIds) || body.rowingSessionIds.length === 0) {
      return NextResponse.json({ overlaps: [] });
    }
    rowingSessionIds = body.rowingSessionIds as string[];
  } catch {
    return NextResponse.json({ overlaps: [] });
  }

  // Fetch the rowing sessions' timestamps
  const rowingSessions = await prisma.rowingSession.findMany({
    where: { id: { in: rowingSessionIds }, userId },
    select: { id: true, timestamp: true },
  });

  if (rowingSessions.length === 0) {
    return NextResponse.json({ overlaps: [] });
  }

  // Fetch unlinked mocap sessions for this user (ready status, no rowingSessionId)
  const mocapSessions = await prisma.mocapSession.findMany({
    where: { userId, rowingSessionId: null, status: "ready" },
    select: { id: true, createdAt: true, durationSec: true },
  });

  if (mocapSessions.length === 0) {
    return NextResponse.json({ overlaps: [] });
  }

  const overlaps: Array<{ rowingSessionId: string; mocapSessionId: string }> = [];

  for (const rs of rowingSessions) {
    const rsTime = rs.timestamp.getTime();
    const rsStart = rsTime - OVERLAP_MARGIN_MS;
    const rsEnd = rsTime + OVERLAP_MARGIN_MS;

    for (const ms of mocapSessions) {
      const msStart = ms.createdAt.getTime();
      const msEnd = msStart + ms.durationSec * 1000;

      // Overlap check: mocap window [msStart, msEnd] overlaps [rsStart, rsEnd]
      if (msEnd >= rsStart && msStart <= rsEnd) {
        overlaps.push({ rowingSessionId: rs.id, mocapSessionId: ms.id });
        // One mocap session can only link to one rowing session — stop after first match
        break;
      }
    }
  }

  return NextResponse.json({ overlaps });
}
