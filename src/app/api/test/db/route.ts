import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('[TEST] Database connected successfully');
    
    // Test if GeneratedAchievement table exists
    const count = await prisma.generatedAchievement.count();
    console.log('[TEST] GeneratedAchievement table exists, count:', count);
    
    // Test User table
    const userCount = await prisma.user.count();
    console.log('[TEST] User table exists, count:', userCount);
    
    return NextResponse.json({ 
      success: true,
      generatedAchievementCount: count,
      userCount: userCount
    });
  } catch (error) {
    console.error('[TEST] Database test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
