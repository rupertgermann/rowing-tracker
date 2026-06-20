import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  SIDECAR_DEFAULT_PORT,
  stopSidecarSession,
} from "@/lib/mocap/sidecarClient";

const StopBody = z.object({
  port: z.number().int().positive().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mocapSession = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!mocapSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: z.infer<typeof StopBody>;
  try {
    body = StopBody.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const port = body.port ?? SIDECAR_DEFAULT_PORT;
  try {
    await stopSidecarSession(port);
    return NextResponse.json({ status: "stopped", port });
  } catch (err) {
    return NextResponse.json(
      {
        status: "unreachable",
        port,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
