import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Create Redis client - falls back to no-op if env vars not set
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limiters for different use cases
export const rateLimiters = {
  // General API: 100 requests per minute
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "ratelimit:api",
      })
    : null,

  // Auth endpoints: 10 requests per minute (protect against brute force)
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "ratelimit:auth",
      })
    : null,

  // AI endpoints: 20 requests per minute (expensive operations)
  ai: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
        prefix: "ratelimit:ai",
      })
    : null,

  // Upload endpoints: 30 requests per minute
  upload: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: true,
        prefix: "ratelimit:upload",
      })
    : null,

  // Sensitive operations (delete, export): 5 requests per minute
  sensitive: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        analytics: true,
        prefix: "ratelimit:sensitive",
      })
    : null,
};

export type RateLimitType = keyof typeof rateLimiters;

/**
 * Check rate limit for a given identifier and limiter type
 * Returns null if rate limiting is disabled or allowed, error response if blocked
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): Promise<NextResponse | null> {
  const limiter = rateLimiters[type];

  // If no Redis configured, skip rate limiting (development mode)
  if (!limiter) {
    return null;
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please slow down and try again later",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null;
  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    console.error("Rate limit check failed:", error);
    return null;
  }
}

/**
 * Get identifier for rate limiting
 * Uses user ID if authenticated, falls back to IP
 */
export function getRateLimitIdentifier(
  userId?: string | null,
  request?: Request
): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP from various headers
  if (request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return `ip:${forwarded.split(",")[0].trim()}`;
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return `ip:${realIp}`;
    }
  }

  return "ip:unknown";
}

/**
 * Helper to apply rate limiting in API routes
 * Usage:
 * ```
 * const rateLimitResponse = await applyRateLimit(request, session?.user?.id, "api");
 * if (rateLimitResponse) return rateLimitResponse;
 * ```
 */
export async function applyRateLimit(
  request: Request,
  userId?: string | null,
  type: RateLimitType = "api"
): Promise<NextResponse | null> {
  const identifier = getRateLimitIdentifier(userId, request);
  return checkRateLimit(identifier, type);
}
