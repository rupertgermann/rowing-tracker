import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists with that email, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Delete any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

    // Check if email is configured
    if (!process.env.EMAIL_SERVER || !process.env.EMAIL_FROM) {
      console.error("Email not configured. Set EMAIL_SERVER and EMAIL_FROM in .env");
      console.log(`Reset link for ${email}: ${resetUrl}`);
      return NextResponse.json({
        message: "If an account exists with that email, a password reset link has been sent.",
        resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined
      });
    }

    try {
      const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);

      await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Reset Your Password - Rowing Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>Hello ${user.name || "there"},</p>
          <p>You requested to reset your password for your Rowing Tracker account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            This link will expire in 1 hour.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `
Reset Your Password

Hello ${user.name || "there"},

You requested to reset your password for your Rowing Tracker account.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.
If you didn't request this, you can safely ignore this email.
      `,
      });

      return NextResponse.json({
        message: "If an account exists with that email, a password reset link has been sent.",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      console.log(`Reset link for ${email}: ${resetUrl}`);
      return NextResponse.json({
        message: "If an account exists with that email, a password reset link has been sent.",
        resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined,
        warning: "Email failed to send. Check console for reset link."
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
