import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/chat
 * Fetch all chat sessions for the authenticated user
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

    const chatSessions = await prisma.chatSession.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ chatSessions });
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat
 * Create or update chat sessions
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

    const { chatSessions } = await req.json();

    if (!Array.isArray(chatSessions)) {
      return NextResponse.json(
        { error: "Invalid chat sessions data" },
        { status: 400 }
      );
    }

    const savedSessions = [];

    for (const chatData of chatSessions) {
      // Check if chat session exists
      const existing = await prisma.chatSession.findFirst({
        where: {
          id: chatData.id,
          userId: session.user.id,
        },
      });

      if (existing) {
        // Update existing chat session
        const updated = await prisma.chatSession.update({
          where: { id: existing.id },
          data: {
            title: chatData.title,
            category: chatData.category,
            model: chatData.model,
          },
        });

        // Delete existing messages
        await prisma.chatMessage.deleteMany({
          where: { sessionId: existing.id },
        });

        // Create new messages
        if (chatData.messages && Array.isArray(chatData.messages)) {
          for (const msgData of chatData.messages) {
            await prisma.chatMessage.create({
              data: {
                sessionId: updated.id,
                role: msgData.role,
                content: msgData.content,
                model: msgData.model,
                attachmentType: msgData.attachmentType,
                attachmentData: msgData.attachmentData,
                timestamp: msgData.timestamp ? new Date(msgData.timestamp) : new Date(),
              },
            });
          }
        }

        savedSessions.push(updated);
      } else {
        // Create new chat session
        const created = await prisma.chatSession.create({
          data: {
            userId: session.user.id,
            title: chatData.title,
            category: chatData.category || 'general',
            model: chatData.model,
            createdAt: chatData.createdAt ? new Date(chatData.createdAt) : new Date(),
          },
        });

        // Create messages
        if (chatData.messages && Array.isArray(chatData.messages)) {
          for (const msgData of chatData.messages) {
            await prisma.chatMessage.create({
              data: {
                sessionId: created.id,
                role: msgData.role,
                content: msgData.content,
                model: msgData.model,
                attachmentType: msgData.attachmentType,
                attachmentData: msgData.attachmentData,
                timestamp: msgData.timestamp ? new Date(msgData.timestamp) : new Date(),
              },
            });
          }
        }

        savedSessions.push(created);
      }
    }

    return NextResponse.json({ 
      chatSessions: savedSessions,
      count: savedSessions.length 
    });
  } catch (error) {
    console.error("Error saving chat sessions:", error);
    return NextResponse.json(
      { error: "Failed to save chat sessions" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat
 * Delete a chat session
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

    const { chatSessionId } = await req.json();

    await prisma.chatSession.delete({
      where: {
        id: chatSessionId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
}
