import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

import { applyRateLimit } from "@/lib/rateLimit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(request: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const limited = await applyRateLimit(request, null, "auth");
  if (limited) return limited;
  return handler(request, context);
}
