import { prisma } from "@/lib/db/prisma";
import type { MocapCaptureFinalizationState } from "@/lib/mocap/lifecycle";

type MocapStatus = "capturing" | "analyzing" | "ready";
type StatusTransition = { from: string | string[] };

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
  if (transition) {
    const updated = await prisma.mocapSession.updateMany({
      where: transitionStatusWhere(mocapSessionId, transition),
      data: { status },
    });
    if (updated.count !== 1) return null;
    return prisma.mocapSession.findUniqueOrThrow({
      where: { id: mocapSessionId },
      select: { status: true },
    });
  }

  return prisma.mocapSession.update({
    where: { id: mocapSessionId },
    data: { status },
    select: { status: true },
  });
}

export async function setMocapCaptureFinalizationState(
  mocapSessionId: string,
  state: MocapCaptureFinalizationState,
  transition?: StatusTransition,
): Promise<{ status: string; durationSec: number } | null> {
  if (transition) {
    const updated = await prisma.mocapSession.updateMany({
      where: transitionStatusWhere(mocapSessionId, transition),
      data: state,
    });
    if (updated.count !== 1) return null;
    return prisma.mocapSession.findUniqueOrThrow({
      where: { id: mocapSessionId },
      select: { status: true, durationSec: true },
    });
  }

  return prisma.mocapSession.update({
    where: { id: mocapSessionId },
    data: state,
    select: { status: true, durationSec: true },
  });
}
