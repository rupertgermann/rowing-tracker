import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { applyRateLimit } from "@/lib/rateLimit";

type ChatCategory = 'chat' | 'explanation' | 'plan_analysis' | 'insight_discussion';

function parseLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * GET /api/chat
 * - List sessions: GET /api/chat
 * - Fetch messages: GET /api/chat?sessionId=...&cursor=...&limit=50
 * - Search messages: GET /api/chat?search=...&limit=50
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const search = searchParams.get('search');

    // Search across messages (DB-backed)
    if (search && search.trim().length > 0) {
      const limit = parseLimit(searchParams.get('limit'), 50, 200);
      const matches = await prisma.chatMessage.findMany({
        where: {
          session: {
            userId: session.user.id,
          },
          content: {
            contains: search.trim(),
            mode: 'insensitive',
          },
        },
        include: {
          session: {
            select: {
              id: true,
              title: true,
              category: true,
              chartId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      return NextResponse.json({
        results: matches.map(m => ({
          message: m,
          session: m.session,
        }))
      });
    }

    // Fetch messages for a session (paginated)
    if (sessionId) {
      const limit = parseLimit(searchParams.get('limit'), 50, 200);
      const cursor = searchParams.get('cursor');

      // Verify ownership
      const existingSession = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!existingSession) {
        return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
      }

      const messages = await prisma.chatMessage.findMany({
        where: {
          sessionId,
        },
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
        take: limit,
      });

      const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;
      return NextResponse.json({ messages, nextCursor });
    }

    // List sessions (no full messages to keep payload small)
    const chatSessions = await prisma.chatSession.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        messages: {
          select: {
            id: true,
            role: true,
            content: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({
      chatSessions: chatSessions.map(s => ({
        id: s.id,
        userId: s.userId,
        title: s.title,
        category: s.category,
        chartId: s.chartId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
        lastMessage: s.messages[0] || null,
      }))
    });
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
 * Supports incremental operations:
 * - { action: 'createSession', title?, category?, chartId? }
 * - { action: 'updateSession', sessionId, title?, category?, chartId? }
 * - { action: 'appendMessage', sessionId, message: { role, content, model?, attachmentType?, attachmentData?, timestamp?, responseId? } }
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

    // Rate limit: 20 requests per minute for AI/chat endpoints
    const rateLimitResponse = await applyRateLimit(req, session.user.id, "ai");
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === 'createSession') {
      const title = (body?.title as string | undefined) || 'Chat';
      const category = (body?.category as ChatCategory | undefined) || 'chat';
      const chartId = (body?.chartId as string | undefined) || null;

      const created = await prisma.chatSession.create({
        data: {
          userId: session.user.id,
          title,
          category,
          chartId,
        },
      });

      return NextResponse.json({ session: created });
    }

    if (action === 'updateSession') {
      const sessionId = body?.sessionId as string | undefined;
      if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
      }

      const existing = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
      }

      const updated = await prisma.chatSession.update({
        where: { id: existing.id },
        data: {
          ...(body?.title !== undefined ? { title: body.title } : {}),
          ...(body?.category !== undefined ? { category: body.category } : {}),
          ...(body?.chartId !== undefined ? { chartId: body.chartId } : {}),
        },
      });

      return NextResponse.json({ session: updated });
    }

    if (action === 'appendMessage') {
      const sessionId = body?.sessionId as string | undefined;
      const message = body?.message as any;
      if (!sessionId || !message?.role || !message?.content) {
        return NextResponse.json({ error: 'Invalid appendMessage payload' }, { status: 400 });
      }

      const existing = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
      }

      const createdMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: message.role,
          content: message.content,
          model: message.model || null,
          attachmentType: message.attachmentType || null,
          attachmentData: message.attachmentData || null,
          timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
        },
      });

      // Touch the session updatedAt
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {},
      });

      return NextResponse.json({ message: createdMessage });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
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

    const body = await req.json().catch(() => ({}));
    const chatSessionId = body?.chatSessionId as string | undefined;
    const all = body?.all as boolean | undefined;

    if (all) {
      await prisma.chatSession.deleteMany({
        where: {
          userId: session.user.id,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (!chatSessionId) {
      return NextResponse.json({ error: 'Missing chatSessionId' }, { status: 400 });
    }

    // Ensure ownership before delete
    const existing = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    await prisma.chatSession.delete({
      where: { id: existing.id },
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
