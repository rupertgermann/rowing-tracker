import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { applyRateLimit } from "@/lib/rateLimit";

const deleteSchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmPhrase: z.string().refine(
    (val) => val === "DELETE MY ACCOUNT",
    { message: "Please type 'DELETE MY ACCOUNT' to confirm" }
  ),
});

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit: 5 requests per minute for sensitive operations
    const rateLimitResponse = await applyRateLimit(req, session.user.id, "sensitive");
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const result = deleteSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { password } = result.data;

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify password (for OAuth users without password, skip this check)
    if (user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 403 }
        );
      }
    }

    // Delete user - cascade will delete all related data
    // This includes: sessions, PRs, awards, plans, chats, insights, settings, API keys, etc.
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted."
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
