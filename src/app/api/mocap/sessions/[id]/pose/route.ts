// Compatibility alias for the original upload route. New clients should use
// /api/mocap/sessions/:id/pose-stream.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export { POST } from "../pose-stream/route";
