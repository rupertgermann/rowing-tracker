import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Check if the current user is an admin
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized - Please log in" },
      { status: 401 }
    );
  }
  
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }
  
  return null; // No error, user is admin
}

/**
 * Check if the current user is an admin (returns boolean)
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "admin";
}

/**
 * Get current session or throw error
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized - Please log in" },
      { status: 401 }
    );
  }
  
  return session;
}
