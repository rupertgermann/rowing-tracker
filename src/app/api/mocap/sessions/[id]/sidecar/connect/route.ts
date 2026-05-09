import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { checkSidecarHealth, SIDECAR_DEFAULT_PORT } from "@/lib/mocap/sidecarClient";

const ConnectBody = z.object({
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
    select: { id: true, status: true },
  });
  if (!mocapSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (mocapSession.status !== "capturing") {
    return NextResponse.json(
      { error: `Session is ${mocapSession.status}; expected capturing` },
      { status: 409 },
    );
  }

  let body: z.infer<typeof ConnectBody>;
  try {
    body = ConnectBody.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const port = body.port ?? SIDECAR_DEFAULT_PORT;

  try {
    const health = await checkSidecarHealth(port);
    return NextResponse.json({
      status: "connected",
      fps: health.fps,
      cameras: health.cameras,
      schemaVersion: health.schemaVersion,
      port,
    });
  } catch {
    return NextResponse.json({ status: "unreachable", port }, { status: 503 });
  }
}
