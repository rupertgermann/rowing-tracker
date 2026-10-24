import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { computeEarnedAwards } from "../src/lib/rowingSessionProjections";
import type { Session } from "../src/types/session";

interface BenchmarkResult {
  sessionCount: number;
  samples: number;
  warmups: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  earnedAwardCount: number;
  resultChecksum: string;
}

function numericArgument(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const value = raw === undefined ? fallback : Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid --${name} value: ${raw}`);
  }

  return value;
}

function stringArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function makeSessions(count: number): Session[] {
  const start = Date.UTC(2023, 0, 1, 12);
  const distances = [500, 1000, 2000, 5000];

  return Array.from({ length: count }, (_, index) => {
    const distance = distances[index % distances.length];
    const avgPower = 140 + (index % 180);
    const duration = Math.round((distance / 500) * (130 - Math.min(index / 50, 25)));

    return {
      id: `benchmark-session-${index.toString().padStart(4, "0")}`,
      timestamp: new Date(start + index * 86_400_000),
      distance,
      duration,
      energy: Math.round(duration * avgPower / 1000),
      strokeCount: Math.max(1, Math.round(duration / 2.4)),
      avgPower,
      maxPower: avgPower + 45,
      wattPerKg: avgPower / 75,
      avgSplit: duration / (distance / 500),
      minSplit: Math.max(70, duration / (distance / 500) - 8),
      avgWork: avgPower * 2.4,
      avgStrokeLength: 8 + (index % 30) / 10,
      avgStrokeRate: 24 + (index % 12),
      maxStrokeRate: 30 + (index % 12),
    };
  });
}

function resultChecksum(result: ReturnType<typeof computeEarnedAwards>): string {
  return result
    .map((award) => `${award.awardId}:${award.earnedAt.toISOString()}`)
    .join("|");
}

async function run(): Promise<void> {
  const sessionCount = numericArgument("sessions", 1000);
  const samples = numericArgument("samples", 3);
  const warmups = numericArgument("warmups", 1);
  const maxMedianMs = numericArgument("max-median-ms", 0);
  const outputPath = stringArgument("json");

  if (!Number.isInteger(sessionCount) || sessionCount < 1) {
    throw new Error("--sessions must be a positive integer");
  }
  if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(warmups)) {
    throw new Error("--samples must be positive and --warmups must be a non-negative integer");
  }

  const sessions = makeSessions(sessionCount);
  let expectedChecksum: string | undefined;
  let earnedAwardCount = 0;
  const timings: number[] = [];

  for (let iteration = 0; iteration < warmups + samples; iteration += 1) {
    const startedAt = performance.now();
    const result = computeEarnedAwards(sessions);
    const durationMs = performance.now() - startedAt;
    const checksum = resultChecksum(result);

    expectedChecksum ??= checksum;
    if (checksum !== expectedChecksum) {
      throw new Error("Projection result changed between benchmark iterations");
    }

    earnedAwardCount = result.length;
    if (iteration >= warmups) timings.push(durationMs);
  }

  const result: BenchmarkResult = {
    sessionCount,
    samples,
    warmups,
    medianMs: percentile(timings, 0.5),
    p95Ms: percentile(timings, 0.95),
    minMs: Math.min(...timings),
    maxMs: Math.max(...timings),
    earnedAwardCount,
    resultChecksum: expectedChecksum ?? "",
  };

  console.log(JSON.stringify(result, null, 2));

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  if (maxMedianMs > 0 && result.medianMs > maxMedianMs) {
    throw new Error(
      `Median ${result.medianMs.toFixed(1)}ms exceeded ${maxMedianMs.toFixed(1)}ms budget`,
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
