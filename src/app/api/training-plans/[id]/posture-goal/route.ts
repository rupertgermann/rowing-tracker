import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { POSTURE_FAULT_CATALOG_V1 } from "@/lib/mocap/analysis/postureThresholds";
import { computePostureGoalProgress } from "@/lib/postureGoalProgress";
import type { PostureFaultType } from "@/lib/mocap/analysis/types";
import type { SessionFaultInput } from "@/lib/mocap/postureTrendAggregation";

async function getAuthedPlan(planId: string, userId: string) {
  return prisma.trainingPlan.findFirst({
    where: { id: planId, userId },
  });
}

/**
 * GET /api/training-plans/[id]/posture-goal
 * Returns the plan's posture goal and current progress derived from linked mocap sessions.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const plan = await getAuthedPlan(planId, session.user.id);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const goal = await prisma.planPostureGoal.findUnique({ where: { planId } });
  if (!goal) {
    return NextResponse.json({ goal: null, progress: null });
  }

  // Gather linked mocap sessions through the plan's training sessions
  const links = await prisma.trainingSessionLink.findMany({
    where: { trainingSession: { week: { planId } } },
    select: { rowingSessionId: true },
  });
  const rowingSessionIds = links.map((l) => l.rowingSessionId);

  const mocapSessions = await prisma.mocapSession.findMany({
    where: { rowingSessionId: { in: rowingSessionIds }, status: "ready" },
    include: {
      postureFaults: { select: { faultType: true, severity: true } },
      strokePostureMetrics: { select: { id: true } },
    },
  });

  const sessionInputs: SessionFaultInput[] = mocapSessions.map((ms) => ({
    sessionId: ms.id,
    sessionDate: ms.createdAt,
    qualityScore: ms.qualityScore,
    qualityFlags: ms.qualityFlags,
    faults: ms.postureFaults.map((f) => ({
      faultType: f.faultType,
      severity: f.severity,
    })),
    strokeCount: ms.strokePostureMetrics.length,
  }));

  const progress = computePostureGoalProgress(
    sessionInputs,
    goal.faultType as PostureFaultType,
    goal.targetRate,
  );

  return NextResponse.json({ goal, progress });
}

/**
 * PUT /api/training-plans/[id]/posture-goal
 * Create or replace the posture goal for a plan.
 * Body: { faultType: string, targetRate: number }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const plan = await getAuthedPlan(planId, session.user.id);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const body = await req.json();
  const { faultType, targetRate } = body;

  if (!POSTURE_FAULT_CATALOG_V1.includes(faultType as PostureFaultType)) {
    return NextResponse.json({ error: "Invalid faultType" }, { status: 400 });
  }
  if (typeof targetRate !== "number" || targetRate < 0 || targetRate > 1) {
    return NextResponse.json(
      { error: "targetRate must be a number between 0 and 1" },
      { status: 400 },
    );
  }

  const goal = await prisma.planPostureGoal.upsert({
    where: { planId },
    update: { faultType, targetRate },
    create: { planId, faultType, targetRate },
  });

  return NextResponse.json({ goal });
}

/**
 * DELETE /api/training-plans/[id]/posture-goal
 * Remove the posture goal from a plan.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const plan = await getAuthedPlan(planId, session.user.id);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  await prisma.planPostureGoal.deleteMany({ where: { planId } });

  return NextResponse.json({ success: true });
}
