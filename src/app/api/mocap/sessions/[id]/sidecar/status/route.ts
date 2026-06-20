import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { checkSidecarHealth, SIDECAR_DEFAULT_PORT } from "@/lib/mocap/sidecarClient";

export async function GET(
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

  const url = new URL(req.url);
  const port = parseInt(url.searchParams.get("port") ?? String(SIDECAR_DEFAULT_PORT), 10);

  try {
    const health = await checkSidecarHealth(port);
    return NextResponse.json({ ...health, port });
  } catch {
    return NextResponse.json({ status: "unreachable", port }, { status: 503 });
  }
}
