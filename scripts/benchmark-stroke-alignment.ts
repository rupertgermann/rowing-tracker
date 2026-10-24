import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  alignStrokesToCsv,
  type AlignmentResult,
  type CsvStrokeTarget,
} from "../src/lib/mocap/analysis/strokeAlignment";

interface SizeResult {
  strokeCount: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  matchedCount: number;
  resultChecksum: string;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function numericArgument(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid --${name} value: ${raw}`);
  }
  return value;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function makeFixture(strokeCount: number): {
  poseCatchTimesMs: number[];
  csvStrokes: CsvStrokeTarget[];
} {
  return {
    poseCatchTimesMs: Array.from(
      { length: strokeCount },
      (_, index) => index * 2400 + ((index * 37) % 211),
    ),
    csvStrokes: Array.from({ length: strokeCount }, (_, index) => ({
      id: `csv-${index}`,
      strokeIndex: index,
      timeMs: 30_000 + index * 2400 + ((index * 53) % 191),
    })),
  };
}

function checksum(result: AlignmentResult): string {
  const serializable = {
    deltaMs: result.deltaMs,
    matchedCount: result.matchedCount,
    matches: [...result.matches.entries()],
    unmatchedPoseStrokes: result.unmatchedPoseStrokes,
    unmatchedCsvStrokes: result.unmatchedCsvStrokes,
  };

  return createHash("sha256").update(JSON.stringify(serializable)).digest("hex");
}

async function run(): Promise<void> {
  const sizes = (argument("sizes") ?? "25,50,100,200,400")
    .split(",")
    .map(Number);
  const samples = numericArgument("samples", 3);
  const warmups = numericArgument("warmups", 1);
  const maxMedianMs = numericArgument("max-median-ms", 0);
  const outputPath = argument("json");

  if (sizes.some((size) => !Number.isInteger(size) || size < 1)) {
    throw new Error("--sizes must contain positive integers");
  }
  if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(warmups)) {
    throw new Error("--samples must be positive and --warmups must be a non-negative integer");
  }

  const results: SizeResult[] = [];

  for (const strokeCount of sizes) {
    const fixture = makeFixture(strokeCount);
    const timings: number[] = [];
    let expectedChecksum: string | undefined;
    let matchedCount = 0;

    for (let iteration = 0; iteration < warmups + samples; iteration += 1) {
      const startedAt = performance.now();
      const result = alignStrokesToCsv(fixture.poseCatchTimesMs, fixture.csvStrokes);
      const durationMs = performance.now() - startedAt;
      const resultChecksum = checksum(result);

      expectedChecksum ??= resultChecksum;
      if (resultChecksum !== expectedChecksum) {
        throw new Error(`Alignment result changed between ${strokeCount}-stroke iterations`);
      }
      if (result.matchedCount !== strokeCount) {
        throw new Error(`Only ${result.matchedCount}/${strokeCount} strokes matched`);
      }

      matchedCount = result.matchedCount;
      if (iteration >= warmups) timings.push(durationMs);
    }

    results.push({
      strokeCount,
      medianMs: percentile(timings, 0.5),
      p95Ms: percentile(timings, 0.95),
      minMs: Math.min(...timings),
      maxMs: Math.max(...timings),
      matchedCount,
      resultChecksum: expectedChecksum ?? "",
    });
  }

  const output = { samples, warmups, results };
  console.log(JSON.stringify(output, null, 2));

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }

  const slowestMedian = Math.max(...results.map((result) => result.medianMs));
  if (maxMedianMs > 0 && slowestMedian > maxMedianMs) {
    throw new Error(
      `Slowest median ${slowestMedian.toFixed(1)}ms exceeded ${maxMedianMs.toFixed(1)}ms budget`,
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
