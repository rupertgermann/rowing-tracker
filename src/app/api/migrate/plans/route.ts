import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

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

    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let migratedCount = 0;

    for (const localPlan of plans) {
      try {
        // Check if plan already exists (by name and start date)
        const existing = await prisma.trainingPlan.findFirst({
          where: {
            userId: session.user.id,
            name: localPlan.name,
            startDate: new Date(localPlan.startDate),
          },
        });

        if (existing) {
          console.log(`Plan already exists: ${localPlan.name}`);
          continue;
        }

        // Create plan
        const plan = await prisma.trainingPlan.create({
          data: {
            userId: session.user.id,
            name: localPlan.name,
            description: localPlan.description || null,
            startDate: new Date(localPlan.startDate),
            endDate: localPlan.endDate ? new Date(localPlan.endDate) : null,
            goalDistance: localPlan.goalDistance || null,
            goalTime: localPlan.goalTime || null,
            status: localPlan.status || 'active',
          },
        });

        // Migrate workouts if they exist
        if (localPlan.workouts && Array.isArray(localPlan.workouts)) {
          for (const workout of localPlan.workouts) {
            try {
              await prisma.workout.create({
                data: {
                  planId: plan.id,
                  name: workout.name,
                  description: workout.description || null,
                  scheduledDate: new Date(workout.scheduledDate),
                  distance: workout.distance || null,
                  duration: workout.duration || null,
                  targetPace: workout.targetPace || null,
                  targetHeartRate: workout.targetHeartRate || null,
                  workoutType: workout.workoutType || 'steady_state',
                  completed: workout.completed || false,
                  completedAt: workout.completedAt ? new Date(workout.completedAt) : null,
                  sessionId: null,
                },
              });
            } catch (error) {
              console.error(`Error migrating workout ${workout.name}:`, error);
            }
          }
        }

        migratedCount++;
      } catch (error) {
        console.error(`Error migrating plan ${localPlan.name}:`, error);
      }
    }

    return NextResponse.json({ 
      count: migratedCount,
      message: `Successfully migrated ${migratedCount} training plans`
    });
  } catch (error) {
    console.error("Plan migration error:", error);
    return NextResponse.json(
      { error: "Failed to migrate training plans" },
      { status: 500 }
    );
  }
}
