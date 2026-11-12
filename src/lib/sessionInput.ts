import { z } from 'zod';
import { INGESTION_LIMITS } from './ingestionLimits';

const number = (max: number) => z.number().finite().nonnegative().max(max);
const date = z.string().min(1).max(64).refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
export const strokeInput = z.object({
  strokeIndex: number(INGESTION_LIMITS.strokes).int(),
  time: number(7 * 86400),
  // Retain exported text (including time-only values); absent timestamps stay empty.
  timestamp: z.string().max(64).default(''),
  distance: number(1_000_000),
  work: number(100_000),
  power: number(10_000),
  avgPower: number(10_000),
  split: number(86400),
  avgSplit: number(86400),
  strokeRate: number(240),
  heartRate: number(300).nullable().optional(),
  strokeLength: number(100).nullable().optional(),
});
export const sessionInput = z.object({
  id: z.string().min(1).max(200).optional(),
  timestamp: date,
  distance: number(1_000_000),
  duration: number(7 * 86400),
  energy: number(100_000).optional(),
  totalCalories: number(100_000).optional(),
  strokeCount: number(1_000_000).int().optional(),
  avgPower: number(10_000).optional(),
  maxPower: number(10_000).optional(),
  wattPerKg: number(1000).optional(),
  avgSplit: number(86400).optional(),
  minSplit: number(86400).optional(),
  avgWork: number(100_000).optional(),
  avgStrokeLength: number(100).optional(),
  avgStrokeRate: number(240).optional(),
  maxStrokeRate: number(240).optional(),
  sourceFile: z.string().max(255).nullable().optional(),
  strokeData: z.array(strokeInput).max(INGESTION_LIMITS.strokes).optional(),
});
export const sessionsInput = z.object({
  sessions: z.array(sessionInput).min(1).max(INGESTION_LIMITS.sessions),
}).refine(body => body.sessions.reduce((sum, session) => sum + (session.strokeData?.length ?? 0), 0) <= INGESTION_LIMITS.strokes,
  'Import exceeds 50000 strokes; split the import into smaller batches');
