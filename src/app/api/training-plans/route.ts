import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

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

    const savedPlans = [];

    for (const planData of plans) {
      // Check if plan exists
      const existing = await prisma.trainingPlan.findFirst({
        where: {
          id: planData.id,
          userId: session.user.id,
        },
      });

      if (existing) {
        // Update existing plan
        const updated = await prisma.trainingPlan.update({
          where: { id: existing.id },
          data: {
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
          },
        });

        // Delete existing weeks and sessions
        await prisma.trainingWeek.deleteMany({
          where: { planId: existing.id },
        });

        // Create new weeks and sessions
        if (planData.weeks && Array.isArray(planData.weeks)) {
          for (const weekData of planData.weeks) {
            const week = await prisma.trainingWeek.create({
              data: {
                planId: updated.id,
                weekNumber: weekData.weekNumber,
                focus: weekData.focus || 'General Training',
                totalVolume: weekData.totalVolume || 0,
                completed: weekData.completed || false,
                actualVolume: weekData.actualVolume || 0,
              },
            });

            // Create sessions for this week
            if (weekData.sessions && Array.isArray(weekData.sessions)) {
              for (const sessionData of weekData.sessions) {
                await prisma.trainingSession.create({
                  data: {
                    weekId: week.id,
                    day: sessionData.day,
                    type: sessionData.type || 'steady_state',
                    title: sessionData.title,
                    description: sessionData.description || '',
                    duration: sessionData.duration || sessionData.targetDuration || 0,
                    distance: sessionData.distance || sessionData.targetDistance,
                    intensity: sessionData.intensity || 'moderate',
                    notes: sessionData.notes,
                    completed: sessionData.completed || false,
                    targetPace: sessionData.targetPace,
                    targetPower: sessionData.targetPower,
                    targetStrokeRate: sessionData.targetStrokeRate,
                  },
                });
              }
            }
          }
        }

        savedPlans.push(updated);
      } else {
        // Create new plan
        const created = await prisma.trainingPlan.create({
          data: {
            userId: session.user.id,
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
          },
        });

        // Create weeks and sessions
        if (planData.weeks && Array.isArray(planData.weeks)) {
          for (const weekData of planData.weeks) {
            const week = await prisma.trainingWeek.create({
              data: {
                planId: created.id,
                weekNumber: weekData.weekNumber,
                focus: weekData.focus || 'General Training',
                totalVolume: weekData.totalVolume || 0,
                completed: weekData.completed || false,
                actualVolume: weekData.actualVolume || 0,
              },
            });

            // Create sessions for this week
            if (weekData.sessions && Array.isArray(weekData.sessions)) {
              for (const sessionData of weekData.sessions) {
                await prisma.trainingSession.create({
                  data: {
                    weekId: week.id,
                    day: sessionData.day,
                    type: sessionData.type || 'steady_state',
                    title: sessionData.title,
                    description: sessionData.description || '',
                    duration: sessionData.duration || sessionData.targetDuration || 0,
                    distance: sessionData.distance || sessionData.targetDistance,
                    intensity: sessionData.intensity || 'moderate',
                    notes: sessionData.notes,
                    completed: sessionData.completed || false,
                    targetPace: sessionData.targetPace,
                    targetPower: sessionData.targetPower,
                    targetStrokeRate: sessionData.targetStrokeRate,
                  },
                });
              }
            }
          }
        }

        savedPlans.push(created);
      }
    }

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
