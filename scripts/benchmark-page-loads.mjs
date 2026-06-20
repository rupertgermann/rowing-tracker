import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import dotenv from "dotenv";
import { encode } from "next-auth/jwt";

for (const envFile of [".env.local", ".env"]) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);

const baseUrl = args.get("url") ?? process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";
const metadataPath = args.get("mock-data") ?? process.env.BENCHMARK_MOCK_DATA_PATH ?? "storage/perf-mock-data.json";
const mockMetadata = fs.existsSync(metadataPath)
  ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  : {};
const mode = args.get("mode") ?? process.env.BENCHMARK_MODE ?? "http";
const thresholdMs = Number(args.get("threshold") ?? process.env.BENCHMARK_THRESHOLD_MS ?? 50);
const warmups = Number(args.get("warmups") ?? process.env.BENCHMARK_WARMUPS ?? 2);
const samples = Number(args.get("samples") ?? process.env.BENCHMARK_SAMPLES ?? 9);
const outputJson = args.get("json") ?? process.env.BENCHMARK_JSON;
const label = args.get("label") ?? process.env.BENCHMARK_LABEL ?? "benchmark";
const failMode = args.get("fail") ?? process.env.BENCHMARK_FAIL ?? "true";
const progressMode = args.get("progress") ?? process.env.BENCHMARK_PROGRESS ?? "false";
const settleTimeoutMs = Number(args.get("settle-timeout") ?? process.env.BENCHMARK_SETTLE_TIMEOUT_MS ?? 10_000);
const apiQuietMs = Number(args.get("api-quiet") ?? process.env.BENCHMARK_API_QUIET_MS ?? 750);
const routeFilter = (args.get("routes") ?? process.env.BENCHMARK_ROUTES ?? "")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const benchmarkUserId = args.get("user-id") ?? process.env.BENCHMARK_USER_ID ?? mockMetadata.userId ?? "benchmark-user";
const sessionId = args.get("session-id") ?? process.env.BENCHMARK_SESSION_ID ?? mockMetadata.sampleSessionId ?? "benchmark-session";
const mocapSessionId = args.get("mocap-session-id") ?? process.env.BENCHMARK_MOCAP_SESSION_ID ?? mockMetadata.sampleMocapSessionId ?? "benchmark-mocap-session";

if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
  throw new Error(`Invalid threshold: ${thresholdMs}`);
}

if (!Number.isInteger(warmups) || warmups < 0 || !Number.isInteger(samples) || samples <= 0) {
  throw new Error(`Invalid warmups/samples: ${warmups}/${samples}`);
}

if (!["http", "browser", "browser-settled"].includes(mode)) {
  throw new Error(`Invalid mode: ${mode}. Expected "http", "browser", or "browser-settled".`);
}

if (!Number.isFinite(settleTimeoutMs) || settleTimeoutMs <= 0) {
  throw new Error(`Invalid settle timeout: ${settleTimeoutMs}`);
}

if (!Number.isFinite(apiQuietMs) || apiQuietMs <= 0) {
  throw new Error(`Invalid API quiet window: ${apiQuietMs}`);
}

function routeFromAppPath(appPath) {
  let route = appPath.replace(/\/page$/, "");
  route = route.replace(/\/\([^/]+\)/g, "");
  route = route.replace(/\[\.\.\.[^\]]+\]/g, "catch-all");
  route = route.replace(/\[id\]/g, (match, offset, fullRoute) => {
    return fullRoute.includes("/mocap/sessions/") ? mocapSessionId : sessionId;
  });
  route = route.replace(/\/+/g, "/");
  return route === "" ? "/" : route;
}

function discoverRoutes() {
  const manifestPath = path.join(".next", "server", "app-paths-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Missing .next/server/app-paths-manifest.json. Run `npm run build` first.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const routes = Object.keys(manifest)
    .filter((appPath) => appPath.endsWith("/page"))
    .filter((appPath) => !appPath.startsWith("/_"))
    .map(routeFromAppPath);

  return [...new Set(routes)].sort((a, b) => a.localeCompare(b));
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

async function buildAuthCookieHeader() {
  const token = await buildAuthToken();
  return `next-auth.session-token=${token}`;
}

async function buildAuthToken() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to benchmark protected pages.");
  }

  return encode({
    secret,
    token: {
      sub: benchmarkUserId,
      id: benchmarkUserId,
      name: "Benchmark User",
      email: "benchmark@example.com",
      role: "admin",
    },
  });
}

async function timeRequest(route, cookieHeader) {
  const startedAt = performance.now();
  const response = await fetch(new URL(route, baseUrl), {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      cookie: cookieHeader,
      "user-agent": "rowing-tracker-page-load-benchmark",
    },
  });
  await response.arrayBuffer();
  return {
    durationMs: performance.now() - startedAt,
    status: response.status,
    finalPath: new URL(response.url).pathname,
  };
}

async function createBrowserTimer() {
  const { chromium } = await import("playwright");
  const authToken = await buildAuthToken();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const secure = new URL(baseUrl).protocol === "https:";
  await context.addCookies([
    {
      name: secure ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      value: authToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure,
    },
  ]);
  const page = await context.newPage();
  const baseOrigin = new URL(baseUrl).origin;
  const isSameOriginApi = (rawUrl) => {
    const url = new URL(rawUrl);
    return url.origin === baseOrigin && url.pathname.startsWith("/api/");
  };

  return {
    async time(route) {
      const apiFailures = [];
      const apiEvents = [];
      const apiRequests = new Map();
      const apiRequestStarts = new Map();
      let lastApiActivityAt = performance.now();
      const onResponse = (response) => {
        const url = new URL(response.url());
        if (isSameOriginApi(response.url()) && response.status() >= 400) {
          apiFailures.push({
            path: url.pathname,
            status: response.status(),
          });
        }
      };
      const onRequest = (request) => {
        if (!isSameOriginApi(request.url())) return;
        apiRequests.set(request, new URL(request.url()).pathname);
        apiRequestStarts.set(request, performance.now());
        lastApiActivityAt = performance.now();
      };
      const onRequestDone = (request) => {
        const apiPath = apiRequests.get(request);
        if (!apiRequests.delete(request)) return;
        const startedAt = apiRequestStarts.get(request);
        apiRequestStarts.delete(request);
        if (apiPath && startedAt !== undefined) {
          apiEvents.push({
            path: apiPath,
            durationMs: performance.now() - startedAt,
          });
        }
        lastApiActivityAt = performance.now();
      };
      const waitForApiQuiet = async () => {
        const deadline = performance.now() + settleTimeoutMs;
        while (performance.now() < deadline) {
          const quietFor = performance.now() - lastApiActivityAt;
          if (apiRequests.size === 0 && quietFor >= apiQuietMs) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, Math.min(100, apiQuietMs)));
        }
        return {
          timedOut: true,
          pendingApis: [...new Set(apiRequests.values())],
        };
      };

      page.on("request", onRequest);
      page.on("response", onResponse);
      page.on("requestfinished", onRequestDone);
      page.on("requestfailed", onRequestDone);
      const startedAt = performance.now();
      try {
        const response = await page.goto(new URL(route, baseUrl).toString(), {
          waitUntil: "load",
        });
        const loadedAt = performance.now();

        const settleResult =
          mode === "browser-settled" ? await waitForApiQuiet() : { timedOut: false, pendingApis: [] };

        const wallDuration = performance.now() - startedAt;
        const navigation = await page.evaluate(() => {
          const entry = performance.getEntriesByType("navigation")[0];
          if (!entry) return null;
          return {
            loadEventEnd: entry.loadEventEnd,
            duration: entry.duration,
          };
        });

        return {
          durationMs:
            mode === "browser-settled"
              ? Math.max(loadedAt, lastApiActivityAt) - startedAt
              : navigation?.loadEventEnd || navigation?.duration || wallDuration,
          status: response?.status() ?? 0,
          finalPath: new URL(page.url()).pathname,
          apiFailures,
          apiEvents,
          apiTimedOut: Boolean(settleResult?.timedOut),
          pendingApis: settleResult?.pendingApis ?? [],
        };
      } finally {
        page.off("request", onRequest);
        page.off("response", onResponse);
        page.off("requestfinished", onRequestDone);
        page.off("requestfailed", onRequestDone);
      }
    },
    async close() {
      await browser.close();
    },
  };
}

async function run() {
  const routes = routeFilter.length > 0
    ? discoverRoutes().filter((route) => routeFilter.includes(route))
    : discoverRoutes();
  const cookieHeader = mode === "http" ? await buildAuthCookieHeader() : null;
  const browserTimer = mode.startsWith("browser") ? await createBrowserTimer() : null;
  const measurements = new Map(routes.map((route) => [route, []]));
  const statuses = new Map();

  console.log(`Benchmarking ${routes.length} pages at ${baseUrl}`);
  console.log(`Conditions: production server, mode=${mode}, user=${benchmarkUserId}, warmups=${warmups}, samples=${samples}, threshold=${thresholdMs}ms, apiQuiet=${apiQuietMs}ms`);
  console.log("");

  try {
    for (let cycle = 0; cycle < warmups + samples; cycle += 1) {
      const isWarmup = cycle < warmups;
      for (const route of routes) {
        const result =
          mode === "http"
            ? await timeRequest(route, cookieHeader)
            : await browserTimer.time(route);
        statuses.set(route, result);
        if (!isWarmup) {
          measurements.get(route).push(result.durationMs);
        }
      }
      if (progressMode === "true") {
        const cycleLabel = isWarmup ? `warmup ${cycle + 1}/${warmups}` : `sample ${cycle - warmups + 1}/${samples}`;
        console.log(`Completed ${cycleLabel}`);
      }
    }
  } finally {
    await browserTimer?.close();
  }

  const rows = routes.map((route) => {
    const values = measurements.get(route);
    const status = statuses.get(route);
    return {
      route,
      status: status.status,
      finalPath: status.finalPath,
      apiFailures: status.apiFailures ?? [],
      apiEvents: status.apiEvents ?? [],
      apiTimedOut: status.apiTimedOut ?? false,
      pendingApis: status.pendingApis ?? [],
      median: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });

  const slowRows = rows.filter((row) => row.median > thresholdMs);
  const badStatusRows = rows.filter((row) => row.status >= 400);
  const apiFailureRows = rows.filter((row) => row.apiFailures.length > 0);

  for (const row of rows) {
    const statusSuffix = row.finalPath === row.route ? "" : ` -> ${row.finalPath}`;
    console.log(
      `${row.median <= thresholdMs ? "PASS" : "FAIL"} ${row.route.padEnd(28)} ` +
        `median=${row.median.toFixed(1).padStart(6)}ms ` +
        `p95=${row.p95.toFixed(1).padStart(6)}ms ` +
        `min=${row.min.toFixed(1).padStart(6)}ms ` +
        `max=${row.max.toFixed(1).padStart(6)}ms ` +
        `status=${row.status}${statusSuffix}` +
        (row.apiFailures.length ? ` apiFailures=${row.apiFailures.length}` : "") +
        (row.apiTimedOut ? ` pendingApis=${row.pendingApis.join(",") || "unknown"}` : ""),
    );
  }

  const result = {
    label,
    baseUrl,
    mode,
    thresholdMs,
    warmups,
    samples,
    apiQuietMs,
    settleTimeoutMs,
    benchmarkUserId,
    sessionId,
    mocapSessionId,
    mockMetadata,
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      pageCount: rows.length,
      slowCount: slowRows.length,
      badStatusCount: badStatusRows.length,
      apiFailureCount: apiFailureRows.length,
      maxMedian: Math.max(...rows.map((row) => row.median)),
      maxP95: Math.max(...rows.map((row) => row.p95)),
    },
  };

  if (outputJson) {
    fs.mkdirSync(path.dirname(outputJson), { recursive: true });
    fs.writeFileSync(outputJson, `${JSON.stringify(result, null, 2)}\n`);
    console.log("");
    console.log(`Wrote JSON results to ${outputJson}`);
  }

  if (badStatusRows.length > 0) {
    console.error("");
    console.error(`Failed: ${badStatusRows.length} page(s) returned HTTP >= 400.`);
    if (failMode !== "false") process.exitCode = 1;
    return;
  }

  if (apiFailureRows.length > 0) {
    console.error("");
    console.error(`Failed: ${apiFailureRows.length} page(s) had API responses >= 400.`);
    if (failMode !== "false") process.exitCode = 1;
    return;
  }

  if (slowRows.length > 0) {
    console.error("");
    console.error(`Failed: ${slowRows.length} page(s) exceeded median threshold ${thresholdMs}ms.`);
    if (failMode !== "false") process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`All ${rows.length} pages loaded under ${thresholdMs}ms median.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
