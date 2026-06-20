import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

const userId = args.get("user-id") ?? process.env.BENCHMARK_USER_ID ?? "benchmark-user";
const email = args.get("email") ?? "benchmark@example.com";
const count = Number(args.get("count") ?? "1000");
const summaryCsv = args.get("summary") ?? "docs/csvs/SmartRow workouts.csv";
const detailCsv = args.get("detail") ?? "docs/csvs/2025-11-16T143854_1000m.csv";
const metadataPath = args.get("metadata") ?? "storage/perf-mock-data.json";
const mocapSessionId = args.get("mocap-session-id") ?? "benchmark-mocap-session";

if (!Number.isInteger(count) || count <= 0) {
  throw new Error(`Invalid session count: ${count}`);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type SummaryRow = {
  timestamp: Date;
  distance: number;
  duration: number;
  energy: number;
  strokeCount: number;
  avgPower: number;
  maxPower: number;
  wattPerKg: number;
  avgSplit: number;
  minSplit: number;
  avgWork: number;
  avgStrokeLength: number;
  avgStrokeRate: number;
  maxStrokeRate: number;
};

type DetailRow = {
  strokeIndex: number;
  time: number;
  timestamp: string;
  distance: number;
  work: number;
  power: number;
  avgPower: number;
  split: number;
  avgSplit: number;
  strokeRate: number;
  heartRate: number | null;
};

function parseEuropeanNumber(value: string | undefined): number {
  if (!value || value.trim() === "") return 0;
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDelimitedCsv(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const delimiter = (headerLine.match(/;/g) ?? []).length >= (headerLine.match(/,/g) ?? []).length ? ";" : ",";
  const headers = headerLine.split(delimiter).map((header) => header.trim());

  return lines.map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseSummaryRows(filePath: string): SummaryRow[] {
  return parseDelimitedCsv(filePath)
    .map((row) => ({
      timestamp: new Date(`${row["Time stamp (UTC)"]}Z`),
      distance: parseEuropeanNumber(row["Distance (m)"]),
      duration: parseEuropeanNumber(row.Time),
      energy: parseEuropeanNumber(row["Energy (kCal)"]),
      strokeCount: parseEuropeanNumber(row["Stroke count (#)"]),
      avgPower: parseEuropeanNumber(row["Average power (W)"]),
      maxPower: parseEuropeanNumber(row["Maximum power (W)"]),
      wattPerKg: parseEuropeanNumber(row["Watt per KG"]),
      avgSplit: parseEuropeanNumber(row["Average split (s)"]),
      minSplit: parseEuropeanNumber(row["Minimum split (s)"]),
      avgWork: parseEuropeanNumber(row["Average work (J)"]),
      avgStrokeLength: parseEuropeanNumber(row["Average stroke length (m)"]),
      avgStrokeRate: parseEuropeanNumber(row["Average stroke rate (SPM)"]),
      maxStrokeRate: parseEuropeanNumber(row["Maximum stroke rate (SPM)"]),
    }))
    .filter((row) => row.distance > 0 && row.duration > 0 && Number.isFinite(row.timestamp.getTime()));
}

function parseDetailRows(filePath: string): DetailRow[] {
  return parseDelimitedCsv(filePath)
    .map((row) => ({
      strokeIndex: Math.round(parseEuropeanNumber(row["Stroke (#)"])),
      time: parseEuropeanNumber(row["Second (#)"]),
      timestamp: row["Timestamp (UTC)"] || "",
      distance: parseEuropeanNumber(row["Distance (m)"]),
      work: parseEuropeanNumber(row["Work (J)"]),
      power: parseEuropeanNumber(row["Actual power (W)"]),
      avgPower: parseEuropeanNumber(row["Average power (W)"]),
      split: parseEuropeanNumber(row["Actual split (s)"]),
      avgSplit: parseEuropeanNumber(row["Average split (s)"]),
      strokeRate: parseEuropeanNumber(row["Stroke rate (SPM)"]),
      heartRate: parseEuropeanNumber(row["Heart rate (bpm)"]) || null,
    }))
    .filter((row) => row.strokeIndex > 0);
}

function consistencyScore(strokes: Array<{ power: number }>): number | null {
  const powers = strokes.map((stroke) => stroke.power).filter((power) => power > 0);
  if (powers.length < 5) return null;

  const avgPower = powers.reduce((sum, power) => sum + power, 0) / powers.length;
  if (avgPower === 0) return null;

  const variance =
    powers.reduce((sum, power) => sum + Math.pow(power - avgPower, 2), 0) / powers.length;
  const coefficient = Math.sqrt(variance) / avgPower;
  return Math.round(Math.max(0, Math.min(100, 100 - coefficient * 200)) * 100) / 100;
}

function buildSession(baseRows: SummaryRow[], index: number) {
  const base = baseRows[index % baseRows.length];
  const dayOffset = Math.floor(index / 2);
  const timestamp = new Date(Date.UTC(2024, 0, 1, 6 + (index % 2) * 10, index % 60, 0));
  timestamp.setUTCDate(timestamp.getUTCDate() + dayOffset);

  const distanceCycle = [500, 750, 1000, 1500, 2000, 5000];
  const distance = distanceCycle[index % distanceCycle.length];
  const distanceRatio = distance / base.distance;
  const trainingDrift = 1 + ((index % 37) - 18) / 250;
  const powerDrift = 1 + ((index % 29) - 14) / 180;
  const avgSplit = Math.max(100, base.avgSplit * trainingDrift);
  const duration = Math.round((avgSplit / 500) * distance);
  const avgPower = Math.max(40, base.avgPower * powerDrift * Math.pow(distanceRatio, -0.06));
  const strokeCount = Math.max(20, Math.round(base.strokeCount * distanceRatio * (1 + ((index % 11) - 5) / 100)));

  return {
    id: `mock-session-${String(index + 1).padStart(4, "0")}`,
    userId,
    timestamp,
    distance,
    duration,
    energy: Math.max(5, Math.round(base.energy * distanceRatio * powerDrift)),
    strokeCount,
    avgPower: Math.round(avgPower * 10) / 10,
    maxPower: Math.round(Math.max(avgPower + 20, base.maxPower * powerDrift) * 10) / 10,
    wattPerKg: Math.round((avgPower / 71) * 100) / 100,
    avgSplit: Math.round(avgSplit * 10) / 10,
    minSplit: Math.round(Math.max(95, avgSplit - 12 - (index % 9)) * 10) / 10,
    avgWork: Math.round(base.avgWork * powerDrift * 10) / 10,
    avgStrokeLength: Math.round((distance / strokeCount) * 100) / 100,
    avgStrokeRate: Math.round((base.avgStrokeRate * (1 + ((index % 13) - 6) / 150)) * 10) / 10,
    maxStrokeRate: Math.round(Math.max(base.maxStrokeRate, base.avgStrokeRate + 2 + (index % 5)) * 10) / 10,
    consistencyScore: null as number | null,
    sourceFile: `mock:${path.basename(summaryCsv)}`,
  };
}

function buildStrokeData(session: ReturnType<typeof buildSession>, detailRows: DetailRow[]) {
  const startedAt = session.timestamp.getTime();
  const strokes = [];

  for (let i = 0; i < session.strokeCount; i += 1) {
    const template = detailRows[i % detailRows.length];
    const progress = (i + 1) / session.strokeCount;
    const time = Math.round(session.duration * progress * 10) / 10;
    const previousDistance = i === 0 ? 0 : (session.distance * i) / session.strokeCount;
    const distance = Math.round(session.distance * progress * 10) / 10;
    const strokeLength = Math.round((distance - previousDistance) * 100) / 100;
    const powerWave = 1 + Math.sin((i / Math.max(1, session.strokeCount - 1)) * Math.PI * 2) * 0.07;
    const power = Math.max(20, Math.round((session.avgPower * powerWave + (template.power || 0) * 0.08) * 10) / 10);
    const splitWave = 1 + Math.cos((i / Math.max(1, session.strokeCount - 1)) * Math.PI * 2) * 0.03;
    const split = Math.round(session.avgSplit * splitWave * 10) / 10;

    strokes.push({
      sessionId: session.id,
      strokeIndex: i + 1,
      time,
      timestamp: new Date(startedAt + time * 1000).toISOString(),
      distance,
      work: Math.round(Math.max(1, template.work || session.avgWork) * powerWave * 10) / 10,
      power,
      avgPower: session.avgPower,
      split,
      avgSplit: session.avgSplit,
      strokeRate: Math.round((session.avgStrokeRate * (1 + Math.sin(i / 6) * 0.04)) * 10) / 10,
      heartRate: null,
      strokeLength,
    });
  }

  return strokes;
}

async function main() {
  const summaryRows = parseSummaryRows(summaryCsv);
  const detailRows = parseDetailRows(detailCsv);

  if (summaryRows.length === 0) {
    throw new Error(`No usable summary rows found in ${summaryCsv}`);
  }
  if (detailRows.length === 0) {
    throw new Error(`No usable detail rows found in ${detailCsv}`);
  }

  console.log(`Seeding ${count} mock rowing sessions for ${userId}`);
  console.log(`Using ${summaryRows.length} summary templates and ${detailRows.length} stroke templates.`);

  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: "Benchmark User",
      role: "admin",
      emailVerified: new Date(),
    },
  });

  await prisma.userSettings.create({
    data: {
      userId,
      theme: "system",
      units: "metric",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "24h",
      language: "en",
      defaultChartType: "line",
      animationsEnabled: true,
      cloudAIEnabled: false,
      maxTokens: 4000,
      sessionsRevision: 1,
      insightsRevision: 1,
    },
  });

  await prisma.mocapSession.create({
    data: {
      id: mocapSessionId,
      userId,
      videoStoragePath: `mocap/${userId}/${mocapSessionId}/video.webm`,
      poseStreamPath: `mocap/${userId}/${mocapSessionId}/pose-stream.bin`,
      source: "browser",
      captureModelVersion: "mock-mediapipe-0.0.0",
      capturePerspective: "side-left",
      captureFps: 30,
      durationSec: 180,
      qualityScore: 0.92,
      qualityFlags: [],
      status: "processing",
    },
  });

  const mocapDir = path.join("storage", "mocap", userId, mocapSessionId);
  fs.mkdirSync(mocapDir, { recursive: true });
  fs.writeFileSync(path.join(mocapDir, "video.webm"), Buffer.from("mock-webm"));

  const sessions = Array.from({ length: count }, (_, index) => buildSession(summaryRows, index));
  const strokes = sessions.flatMap((session) => {
    const strokeData = buildStrokeData(session, detailRows);
    session.consistencyScore = consistencyScore(strokeData);
    return strokeData;
  });

  for (let i = 0; i < sessions.length; i += 200) {
    await prisma.rowingSession.createMany({ data: sessions.slice(i, i + 200) });
  }

  for (let i = 0; i < strokes.length; i += 5000) {
    await prisma.strokeData.createMany({ data: strokes.slice(i, i + 5000) });
  }

  const bestByDistance = new Map<number, (typeof sessions)[number]>();
  for (const session of sessions) {
    const current = bestByDistance.get(session.distance);
    if (!current || session.duration < current.duration) {
      bestByDistance.set(session.distance, session);
    }
  }

  await prisma.personalRecord.createMany({
    data: Array.from(bestByDistance.values()).map((session) => ({
      userId,
      sessionId: session.id,
      distance: session.distance,
      bestTime: session.duration,
      bestPace: session.avgSplit,
      avgPower: session.avgPower,
      achievedAt: session.timestamp,
    })),
  });

  await prisma.aIInsight.createMany({
    data: [
      {
        userId,
        type: "trend",
        title: "Volume base is established",
        description: "The mock dataset contains consistent rowing volume across multiple distances for benchmark analytics.",
        priority: "medium",
        actionable: true,
        confidence: 0.92,
        evidence: ["1000 seeded sessions", "Multiple standard workout distances"],
        category: "training_load",
        source: "mock-seed",
      },
      {
        userId,
        type: "performance",
        title: "Power remains stable",
        description: "Average power varies in a controlled band so charts and summaries have realistic but repeatable values.",
        priority: "low",
        actionable: false,
        confidence: 0.88,
        evidence: ["Generated from SmartRow summary examples"],
        category: "performance",
        source: "mock-seed",
      },
      {
        userId,
        type: "recommendation",
        title: "Benchmark data is current",
        description: "Insights are seeded as current to keep page-load benchmarks focused on loading and rendering costs.",
        priority: "low",
        actionable: false,
        confidence: 1,
        evidence: ["sessionsRevision matches insightsRevision"],
        category: "system",
        source: "mock-seed",
      },
    ],
  });

  const sampleSession = sessions[Math.floor(sessions.length / 2)];
  const metadata = {
    userId,
    email,
    sessionCount: sessions.length,
    strokeCount: strokes.length,
    sampleSessionId: sampleSession.id,
    sampleMocapSessionId: mocapSessionId,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      summaryCsv,
      detailCsv,
    },
  };

  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(`Inserted ${sessions.length} sessions and ${strokes.length} stroke rows.`);
  console.log(`Sample session route: /sessions/${sampleSession.id}`);
  console.log(`Wrote metadata: ${metadataPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
