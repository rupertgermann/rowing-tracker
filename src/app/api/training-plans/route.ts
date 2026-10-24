import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const optionalId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional();
const planIdsSchema = z.array(z.object({
  id: optionalId,
  weeks: z.array(z.object({
    id: optionalId,
    sessions: z.array(z.object({ id: optionalId })).optional(),
  })).optional(),
}));

/**
 * GET /api/training-plans
 * Fetch all training plans for the authenticated user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const plans = await prisma.trainingPlan.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        weeks: {
          include: {
            sessions: true,
          },
          orderBy: {
            weekNumber: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error fetching training plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch training plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training-plans
 * Create or update training plans
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { plans } = await req.json();

    if (!Array.isArray(plans)) {
      return NextResponse.json(
        { error: "Invalid plans data" },
        { status: 400 }
      );
    }

    if (!planIdsSchema.safeParse(plans).success) {
      return NextResponse.json({ error: "Invalid plan or child IDs" }, { status: 400 });
    }

    const savedPlans = await prisma.$transaction(async (tx) => {
      const saved = [];
      for (const planData of plans) {
        const existing = planData.id ? await tx.trainingPlan.findFirst({
          where: { id: planData.id, userId: session.user.id },
          include: { weeks: { include: { sessions: true } } },
        }) : null;
        const data = {
          title: planData.title,
          description: planData.description,
          goals: planData.goals || [],
          duration: planData.duration || planData.weeks?.length || 8,
          level: planData.level || 'intermediate',
          focus: planData.focus || 'general_fitness',
          status: planData.status || 'draft',
          startDate: planData.startDate ? new Date(planData.startDate) : null,
          completedWeeks: planData.progress?.completedWeeks || 0,
          completedSessions: planData.progress?.completedSessions || 0,
          totalSessions: planData.progress?.totalSessions || 0,
          adherenceRate: planData.progress?.adherenceRate || 0,
        };
        // Only owned IDs are updated; a foreign ID collides on create and rolls back.
        const plan = existing
          ? await tx.trainingPlan.update({ where: { id: existing.id }, data })
          : await tx.trainingPlan.create({ data: { ...data, id: planData.id, userId: session.user.id } });

        if (Array.isArray(planData.weeks)) {
          const weekIds: string[] = [];
          for (const weekData of planData.weeks) {
            const previousWeek = existing?.weeks.find(week => week.id === weekData.id);
            const weekValues = {
              weekNumber: weekData.weekNumber,
              focus: weekData.focus ?? previousWeek?.focus ?? 'General Training',
              totalVolume: weekData.totalVolume ?? previousWeek?.totalVolume ?? 0,
              completed: weekData.completed ?? previousWeek?.completed ?? false,
              actualVolume: weekData.actualVolume ?? previousWeek?.actualVolume ?? 0,
            };
            const week = previousWeek
              ? await tx.trainingWeek.update({ where: { id: previousWeek.id }, data: weekValues })
              : await tx.trainingWeek.create({ data: { ...weekValues, id: weekData.id, planId: plan.id } });
            weekIds.push(week.id);

            if (Array.isArray(weekData.sessions)) {
              const sessionIds: string[] = [];
              for (const sessionData of weekData.sessions) {
                const previousSession = previousWeek?.sessions.find(entry => entry.id === sessionData.id);
                const sessionValues = {
                  day: sessionData.day,
                  type: sessionData.type ?? previousSession?.type ?? 'steady_state',
                  title: sessionData.title,
                  description: sessionData.description ?? previousSession?.description ?? '',
                  duration: sessionData.duration ?? sessionData.targetDuration ?? previousSession?.duration ?? 0,
                  distance: sessionData.distance ?? sessionData.targetDistance,
                  intensity: sessionData.intensity ?? previousSession?.intensity ?? 'moderate',
                  notes: sessionData.notes,
                  completed: sessionData.completed ?? previousSession?.completed ?? false,
                  targetPace: sessionData.targetPace,
                  targetPaceMin: sessionData.targetPaceMin,
                  targetPaceMax: sessionData.targetPaceMax,
                  targetPower: sessionData.targetPower,
                  targetPowerMin: sessionData.targetPowerMin,
                  targetPowerMax: sessionData.targetPowerMax,
                  targetStrokeRate: sessionData.targetStrokeRate,
                  targetStrokeRateMin: sessionData.targetStrokeRateMin,
                  targetStrokeRateMax: sessionData.targetStrokeRateMax,
                };
                const trainingSession = previousSession
                  ? await tx.trainingSession.update({ where: { id: previousSession.id }, data: sessionValues })
                  : await tx.trainingSession.create({ data: { ...sessionValues, id: sessionData.id, weekId: week.id } });
                sessionIds.push(trainingSession.id);
              }
              await tx.trainingSession.deleteMany({ where: { weekId: week.id, id: { notIn: sessionIds } } });
            }
          }
          await tx.trainingWeek.deleteMany({ where: { planId: plan.id, id: { notIn: weekIds } } });
        }
        saved.push(plan);
      }
      return saved;
    }, { timeout: 30000 });

    return NextResponse.json({ 
      plans: savedPlans,
      count: savedPlans.length 
    });
  } catch (error) {
    console.error("Error saving training plans:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Failed to save training plans", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training-plans
 * Delete a training plan
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { planId } = await req.json();

    await prisma.trainingPlan.delete({
      where: {
        id: planId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting training plan:", error);
    return NextResponse.json(
      { error: "Failed to delete training plan" },
      { status: 500 }
    );
  }
}
