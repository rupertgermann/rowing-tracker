/**
 * Backfill consistency scores for existing sessions
 * Run with: npx tsx scripts/backfill-consistency.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Load environment variables from .env.local first, then .env
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

function calculateConsistencyScore(strokeData: Array<{ power: number }>): number | null {
  if (!strokeData || strokeData.length < 5) return null;

  const powers = strokeData.map(s => s.power).filter(p => p > 0);
  if (powers.length < 5) return null;

  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
  if (avgPower === 0) return null;

  const squareDiffs = powers.map(v => Math.pow(v - avgPower, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDevPower = Math.sqrt(avgSquareDiff);

  const cvPower = stdDevPower / avgPower;
  const score = Math.max(0, Math.min(100, 100 - (cvPower * 200)));

  return Math.round(score * 100) / 100;
}

async function main() {
  console.log('Starting consistency score backfill...\n');

  // Find all sessions without consistency score
  const sessions = await prisma.rowingSession.findMany({
    where: {
      consistencyScore: null,
    },
    select: {
      id: true,
      strokeData: {
        select: { power: true },
      },
    },
  });

  console.log(`Found ${sessions.length} sessions without consistency score\n`);

  let updated = 0;
  let skipped = 0;

  for (const session of sessions) {
    if (session.strokeData && session.strokeData.length >= 5) {
      const score = calculateConsistencyScore(session.strokeData);
      if (score !== null) {
        await prisma.rowingSession.update({
          where: { id: session.id },
          data: { consistencyScore: score },
        });
        updated++;
        process.stdout.write(`\rUpdated: ${updated} | Skipped: ${skipped}`);
      } else {
        skipped++;
        process.stdout.write(`\rUpdated: ${updated} | Skipped: ${skipped}`);
      }
    } else {
      skipped++;
      process.stdout.write(`\rUpdated: ${updated} | Skipped: ${skipped}`);
    }
  }

  console.log('\n\n--- Backfill Complete ---');
  console.log(`Total sessions processed: ${sessions.length}`);
  console.log(`Updated with scores: ${updated}`);
  console.log(`Skipped (no stroke data): ${skipped}`);

  // Bump sessions revision for all users who had sessions updated
  if (updated > 0) {
    const userIds = await prisma.rowingSession.findMany({
      where: { consistencyScore: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of userIds) {
      await prisma.userSettings.upsert({
        where: { userId },
        update: { sessionsRevision: { increment: 1 } },
        create: {
          userId,
          theme: 'system',
          units: 'metric',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '24h',
          language: 'en',
          defaultChartType: 'line',
          animationsEnabled: true,
          cloudAIEnabled: false,
          maxTokens: 4000,
          sessionsRevision: 1,
        },
      });
    }
    console.log(`\nBumped sessionsRevision for ${userIds.length} user(s) to invalidate caches`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
