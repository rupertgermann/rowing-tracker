import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
  newPassword: z.string().min(8).optional(),
});

/**
 * GET /api/admin/users/[userId]
 * Get user details (admin only)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  const { userId } = await context.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            rowingSessions: true,
            trainingPlans: true,
            earnedAwards: true,
            chatSessions: true,
            aiInsights: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[userId]
 * Update user (admin only)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  const { userId } = await context.params;

  try {
    const body = await req.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { name, email, role, newPassword } = result.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    
    // Hash new password if provided
    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({ 
      user: updatedUser,
      message: "User updated successfully"
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Delete user and all their data (admin only)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  const { userId } = await context.params;

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deleting admin users (safety check)
    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete admin users" },
        { status: 403 }
      );
    }

    // Delete user (cascade will delete all related data)
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ 
      message: "User and all associated data deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
