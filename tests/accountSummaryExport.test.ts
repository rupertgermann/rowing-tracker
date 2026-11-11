import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { accountSummaryScope } from '../src/lib/accountSummaryScope';
import { loadModule } from './helpers/loadModule';

// Give every stored scalar a distinguishable value so omitted fields cannot hide in empty fixtures.
const schema = readFileSync('prisma/schema.prisma', 'utf8');
function row(model: string): Record<string, unknown> {
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))![1];
  return Object.fromEntries([...block.matchAll(/^\s+(\w+)\s+(String|Int|Float|Boolean|DateTime|Json|Bytes)(\[\])?\??\s/gm)]
    .map(([, key, type, array]) => [key, array ? [`${model}.${key}`] : type === 'Int' || type === 'Float' ? 42 : type === 'Boolean' ? true : type === 'Json' ? { fixture: key } : `${model}.${key}`]));
}
const pick = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map(key => [key, value[key]]));

test('download identifies its limits and preserves every documented summary category and field', async () => {
  const user = row('User');
  const settings = row('UserSettings');
  const stroke = row('StrokeData');
  const session = { ...row('RowingSession'), strokeData: [stroke] };
  const record = row('PersonalRecord');
  const award = row('EarnedAward');
  const plan = { ...row('TrainingPlan'), weeks: [{ ...row('TrainingWeek'), sessions: [{ ...row('TrainingSession'), actualSessionLinks: [row('TrainingSessionLink')] }] }] };
  const chat = { ...row('ChatSession'), messages: [row('ChatMessage')] };
  const insight = row('AIInsight');
  const achievement = row('GeneratedAchievement');
  const memory = row('MemoryDocument');
  const prisma = Object.fromEntries(Object.entries({ user, userSettings: settings, rowingSession: session, personalRecord: record, earnedAward: award, trainingPlan: plan, chatSession: chat, aIInsight: insight, generatedAchievement: achievement, memoryDocument: memory }).map(([name, value]) => {
    const query = async ({ where, select }: { where: Record<string, string>; select?: Record<string, boolean> }) => {
      assert.equal(where[name === 'user' ? 'id' : 'userId'], 'alice');
      return select ? pick(value, Object.keys(select)) : value;
    };
    return [name, { findUnique: query, findMany: async (args: Parameters<typeof query>[0]) => [await query(args)] }];
  }));
  const route = loadModule<{ GET(req: Request): Promise<Response> }>('src/app/api/user/export/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'alice' } }) },
    '@/lib/accountSummaryScope': { accountSummaryScope },
    '@/lib/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma },
    '@/lib/rateLimit': { applyRateLimit: async () => null },
  });
  const response = await route.GET(new Request('http://localhost/api/user/export'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.exportFormat, 'Rowing Tracker limited summary');
  assert.equal(data.exportScope.restoreSupported, false);
  assert.match(data.exportScope.warning, /cannot restore/);
  assert.match(response.headers.get('content-disposition')!, /rowing-tracker-summary-/);
  const expected = {
    user: pick(user, ['id', 'email', 'name', 'role', 'emailVerified', 'createdAt', 'updatedAt']),
    settings,
    rowingSessions: [{ ...session, strokeData: [pick(stroke, ['timestamp', 'strokeIndex', 'split', 'power', 'strokeRate', 'distance', 'heartRate'])] }],
    personalRecords: [record], earnedAwards: [award], trainingPlans: [plan],
    chatSessions: [{ ...pick(chat, ['id', 'title', 'category', 'createdAt', 'updatedAt']), messages: [pick(chat.messages[0], ['role', 'content', 'timestamp'])] }],
    aiInsights: [insight],
    generatedAchievements: [pick(achievement, ['id', 'awardId', 'story', 'imageUrl', 'hasImage', 'earnedAt', 'generatedAt'])],
    memoryDocuments: [pick(memory, ['id', 'name', 'type', 'size', 'extractedText', 'uploadedAt'])],
    statistics: { totalRowingSessions: 1, totalDistance: 42, totalDuration: 42, totalPersonalRecords: 1, totalAwards: 1, totalTrainingPlans: 1, totalChatMessages: 1 },
  };
  assert.deepEqual(Object.keys(data.exportScope.included).sort(), Object.keys(expected).sort());
  for (const [category, value] of Object.entries(expected)) assert.deepEqual(data[category], value, category);
  assert.deepEqual(Object.keys(data).sort(), ['exportedAt', 'exportFormat', 'exportScope', ...Object.keys(expected)].sort());
  for (const excluded of ['Mocap', 'files', 'memory', 'stroke', 'credentials', 'browser']) {
    assert.ok(data.exportScope.excluded.some((entry: string) => entry.toLowerCase().includes(excluded.toLowerCase())), excluded);
  }
});
