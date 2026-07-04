import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrismaMocapSessionLifecycle } from "@/lib/mocap/lifecyclePrisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowingSessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, rowingSessionId } = await params;
  const userId = session.user.id;
  const result = await getPrismaMocapSessionLifecycle().link(
    userId,
    id,
    rowingSessionId,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    rowingSessionId: result.rowingSessionId,
    status: result.status,
    analysisMode: result.analysisMode,
    strokeMetricCount: result.strokeMetricCount,
    faultCount: result.faultCount,
  });
}
