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
        // Check if plan already exists (by title and start date)
        const existing = await prisma.trainingPlan.findFirst({
          where: {
            userId: session.user.id,
            title: localPlan.name,
            startDate: localPlan.startDate ? new Date(localPlan.startDate) : null,
          },
        });

        if (existing) {
          console.log(`Plan already exists: ${localPlan.name}`);
          continue;
        }

        // Create plan
        await prisma.trainingPlan.create({
          data: {
            userId: session.user.id,
            title: localPlan.name,
            description: localPlan.description || "",
            goals: [],
            duration: 0,
            level: "beginner",
            focus: "general",
            status: localPlan.status || "active",
            startDate: localPlan.startDate ? new Date(localPlan.startDate) : null,
          },
        });

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
