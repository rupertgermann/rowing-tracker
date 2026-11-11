import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/loadModule';
import type { TrainingPlansService } from '../src/lib/trainingPlans';

type Row = { id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;
type Args = { where?: Record<string, unknown>; data?: Record<string, unknown>; include?: unknown };

function database(initial: Tables, fail: (model: string, action: string) => void = () => {}) {
  let state = structuredClone(initial);
  let serial = 0;
  function client(tables: Tables) {
    const matches = (row: Row, where: Record<string, unknown> = {}) => Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'notIn' in value) return !(value.notIn as unknown[]).includes(row[key]);
      if (value && typeof value === 'object' && 'in' in value) return (value.in as unknown[]).includes(row[key]);
      if (value instanceof Date) return new Date(String(row[key])).getTime() === value.getTime();
      return row[key] === value;
    });
    const hydrate = (model: string, row: Row) => model === 'trainingPlan'
      ? { ...row, weeks: tables.trainingWeek.filter(w => w.planId === row.id).map(w => ({ ...w, sessions: tables.trainingSession.filter(s => s.weekId === w.id) })) }
      : row;
    const result: Record<string, unknown> = { $queryRaw: async () => [], mocapSession: { findUnique: async () => null } };
    for (const model of ['rowingSession', 'strokeData', 'userSettings', 'trainingPlan', 'trainingWeek', 'trainingSession', 'trainingSessionLink']) {
      tables[model] ??= [];
      result[model] = {
        findFirst: async ({ where, include }: Args) => {
          const row = tables[model].find(r => matches(r, where));
          return row ? (include ? hydrate(model, row) : row) : null;
        },
        create: async ({ data = {} }: Args) => {
          fail(model, 'create');
          const row = { id: `db-${++serial}`, ...data } as Row;
          if (tables[model].some(r => r.id === row.id)) throw Object.assign(new Error('duplicate id'), { code: 'P2002' });
          tables[model].push(row);
          return row;
        },
        update: async ({ where, data = {} }: Args) => {
          fail(model, 'update');
          const row = tables[model].find(r => matches(r, where));
          if (!row) throw new Error('Missing row');
          for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
          return row;
        },
        deleteMany: async ({ where }: Args) => {
          const ids = tables[model].filter(r => matches(r, where)).map(r => r.id);
          tables[model] = tables[model].filter(r => !ids.includes(r.id));
          if (model === 'trainingWeek') {
            const removedSessions = tables.trainingSession.filter(s => ids.includes(String(s.weekId))).map(s => s.id);
            tables.trainingSession = tables.trainingSession.filter(s => !removedSessions.includes(s.id));
            tables.trainingSessionLink = tables.trainingSessionLink.filter(l => !removedSessions.includes(String(l.trainingSessionId)));
          }
          if (model === 'trainingSession') tables.trainingSessionLink = tables.trainingSessionLink.filter(l => !ids.includes(String(l.trainingSessionId)));
        },
        createMany: async ({ data }: { data: Row[] }) => {
          fail(model, 'createMany');
          tables[model].push(...data);
        },
        upsert: async () => {
          fail(model, 'upsert');
          const row = tables[model][0];
          if (row) row.sessionsRevision = Number(row.sessionsRevision) + 1;
          else tables[model].push({ id: 'settings', sessionsRevision: 1 });
        },
      };
    }
    return result;
  }
  const prisma = {
    ...client(state),
    $transaction: async (run: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const draft = structuredClone(state);
      const result = await run(client(draft));
      state = draft;
      Object.assign(prisma, client(state));
      return result;
    },
  };
  return { prisma, read: () => structuredClone(state) };
}

function route(file: string, db: ReturnType<typeof database>) {
  const settings = loadModule('src/lib/server/userSettings.ts', { '@/lib/db/prisma': { prisma: db.prisma } });
  return loadModule<{ POST(req: Request): Promise<Response> }>(file, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma: db.prisma },
    '@/lib/analysisUtils': { calculateConsistencyScore: () => 90 },
    '@/lib/server/userSettings': settings,
  });
}
const request = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
const stroke = { strokeIndex: 0, time: 3, timestamp: '00:03', distance: 10, work: 100, power: 200, avgPower: 200, split: 120, avgSplit: 120, strokeRate: 20 };
const session = { id: 'session', userId: 'user', timestamp: '2026-10-23T12:00:00Z', distance: 1000, duration: 240 };
const plan = { id: 'plan_existing', userId: 'user', title: 'Original', description: '', goals: [], duration: 1 };
const week = { id: 'week', planId: plan.id, weekNumber: 1, focus: 'Endurance', totalVolume: 30, completed: true, actualVolume: 30 };
const workout = { id: 'workout', weekId: week.id, day: 1, title: 'Row', description: '', duration: 30, completed: true, targetPowerMin: 150, targetPowerMax: 200 };
const initialPlan = { trainingPlan: [plan], trainingWeek: [week], trainingSession: [workout], trainingSessionLink: [{ id: 'link', trainingSessionId: workout.id, rowingSessionId: session.id }] };

for (const failure of ['strokeData', 'userSettings']) {
  test(`session replacement rolls back strokes, metadata and revision if ${failure} fails`, async () => {
    const db = database({ rowingSession: [session], strokeData: [{ id: 'old', sessionId: session.id, power: 180 }], userSettings: [{ id: 'settings', sessionsRevision: 4 }] }, model => { if (model === failure) throw new Error('Injected write failure'); });
    const before = db.read();
    const result = await route('src/app/api/sessions/route.ts', db).POST(request({ sessions: [{ ...session, duration: 300, strokeData: [stroke] }] }));
    assert.equal(result.status, 500);
    assert.deepEqual(db.read(), before);
  });
}

test('plan replacement rolls back metadata, weeks, sessions and workout links on write failure', async () => {
  const db = database(initialPlan, (model, action) => { if (model === 'trainingWeek' && action === 'create') throw new Error('Injected write failure'); });
  const before = db.read();
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, title: 'Changed', weeks: [{ id: 'replacement', weekNumber: 1, sessions: [] }] }] }));
  assert.equal(result.status, 500);
  assert.deepEqual(db.read(), before);
});

test('successful plan save retains owned child IDs, workout links and omitted target ranges', async () => {
  const db = database(initialPlan);
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, title: 'Changed', weeks: [{ id: week.id, weekNumber: 1, sessions: [{ id: workout.id, day: 1, title: 'Changed row', duration: 30 }] }] }] }));
  assert.equal(result.status, 200);
  assert.equal(db.read().trainingSession[0].id, workout.id);
  assert.equal(db.read().trainingSession[0].targetPowerMin, 150);
  assert.equal(db.read().trainingSession[0].completed, true);
  assert.equal(db.read().trainingWeek[0].actualVolume, 30);
  assert.equal(db.read().trainingWeek[0].completed, true);
  assert.deepEqual(db.read().trainingSessionLink, initialPlan.trainingSessionLink);
});

test('creating a plan preserves its client ID for immediate lookup and activation', async () => {
  const db = database({});
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, id: 'plan_client', weeks: [] }] }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).plans[0].id, 'plan_client');
  assert.equal(db.read().trainingPlan[0].id, 'plan_client');
});

test('a colliding plan ID cannot mutate a different owner or create an unintended duplicate', async () => {
  const db = database({ ...initialPlan, trainingPlan: [{ ...plan, userId: 'other' }] });
  const before = db.read();
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, title: 'Take over', weeks: [] }] }));
  assert.notEqual(result.status, 200);
  assert.deepEqual(db.read(), before);
});

test('foreign child IDs cannot be reassigned to an owned plan', async () => {
  const db = database({ ...initialPlan, trainingWeek: [{ ...week, planId: 'foreign-plan' }] });
  const before = db.read();
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, weeks: [{ ...week, sessions: [] }] }] }));
  assert.notEqual(result.status, 200);
  assert.deepEqual(db.read(), before);
});

for (const failure of ['result', 'exception']) {
  test(`plan creation rejects a failed ${failure} instead of reporting success`, async () => {
    const service = loadModule<{ trainingPlans: TrainingPlansService }>('src/lib/trainingPlans.ts', {
      '@/lib/dataSync': { fetchTrainingPlansFromDB: async () => [], saveTrainingPlansToDB: async () => {
        if (failure === 'exception') throw new Error('Unavailable');
        return { success: false, error: 'Unavailable' };
      } },
      '@/lib/memoryStorage': {},
    }).trainingPlans;
    await assert.rejects(service.createPlan({ title: 'New', description: '', goals: [], duration: 1, level: 'beginner', focus: 'general_fitness', weeks: [], status: 'draft' }), /Unavailable/);
  });
}

test('concurrent session import retries after the aborted transaction and commits one revision', async () => {
  let exists = false;
  let attempts = 0;
  let strokes = [{ power: 180 }];
  let revision = 0;
  const prisma = {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      attempts++;
      let aborted = false;
      let draftStrokes = strokes;
      let draftRevision = revision;
      const check = () => { if (aborted) throw new Error('Transaction is aborted'); };
      const result = await run({
        $queryRaw: async () => [],
        mocapSession: { findUnique: async () => null },
        rowingSession: {
          findFirst: async () => { check(); return exists ? session : null; },
          create: async () => {
            exists = true;
            aborted = true;
            throw Object.assign(new Error('Concurrent import won'), { code: 'P2002' });
          },
          update: async () => { check(); return session; },
        },
        strokeData: {
          deleteMany: async () => { check(); draftStrokes = []; },
          createMany: async ({ data }: { data: typeof strokes }) => { check(); draftStrokes = data; },
        },
        userSettings: { upsert: async () => { check(); draftRevision++; } },
      });
      strokes = draftStrokes;
      revision = draftRevision;
      return result;
    },
  };
  const settings = loadModule('src/lib/server/userSettings.ts', { '@/lib/db/prisma': { prisma } });
  const endpoint = loadModule<{ POST(req: Request): Promise<Response> }>('src/app/api/sessions/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma },
    '@/lib/analysisUtils': { calculateConsistencyScore: () => 90 },
    '@/lib/server/userSettings': settings,
  });
  const result = await endpoint.POST(request({ sessions: [{ ...session, strokeData: [stroke] }] }));
  assert.equal(result.status, 200);
  assert.equal(attempts, 2);
  assert.equal(revision, 1);
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].power, 200);
});

test('foreign session IDs cannot be reassigned to an owned week', async () => {
  const db = database({ ...initialPlan, trainingSession: [{ ...workout, weekId: 'foreign-week' }] });
  const before = db.read();
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, weeks: [{ ...week, sessions: [workout] }] }] }));
  assert.notEqual(result.status, 200);
  assert.deepEqual(db.read(), before);
});

test('invalid client IDs are rejected before writing a plan', async () => {
  const db = database({});
  const result = await route('src/app/api/training-plans/route.ts', db).POST(request({ plans: [{ ...plan, id: '../../other', weeks: [] }] }));
  assert.equal(result.status, 400);
  assert.equal(db.read().trainingPlan.length, 0);
});

test('a newly created plan can immediately be looked up and activated with its returned ID', async () => {
  const db = database({});
  const endpoint = route('src/app/api/training-plans/route.ts', db);
  const storage = new Map<string, string>();
  const service = loadModule<{ trainingPlans: TrainingPlansService }>('src/lib/trainingPlans.ts', {
    '@/lib/dataSync': {
      fetchTrainingPlansFromDB: async () => db.read().trainingPlan,
      saveTrainingPlansToDB: async (plans: unknown[]) => {
        const response = await endpoint.POST(request({ plans }));
        return { success: response.ok };
      },
    },
    '@/lib/memoryStorage': {},
  }, {
    localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
    fetch: async () => Response.json({}),
  }).trainingPlans;
  const created = await service.createPlan({ title: 'New', description: '', goals: [], duration: 1, level: 'beginner', focus: 'general_fitness', weeks: [], status: 'draft' });
  assert.equal((await service.getPlan(created.id))?.id, created.id);
  await service.setActivePlan(created.id);
  assert.equal((await service.getActivePlan())?.id, created.id);
});
