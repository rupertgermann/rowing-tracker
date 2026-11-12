import JSZip from 'jszip';
import { sessionsInput } from '../../src/lib/sessionInput';
import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import type { Session } from '../../src/types/session';

for (const failure of ['http', 'connection-after-commit'] as const) {
  test(`CSV upload refreshes after ${failure} and retry skips committed workouts`, async ({ page, context }) => {
    const owner = 'partial-import-fixture';
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: owner, role: 'user' } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
    const committed = new Map<number, Session>();
    const submittedChunks: number[] = [];
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: owner, name: 'Import fixture' }, expires: '2099-01-01' } });
      if (path === '/api/settings') return route.fulfill({ json: { settings: {} } });
      if (path === '/api/sessions/list') return route.fulfill({ json: { sessions: [...committed.values()], count: committed.size, sessionsRevision: committed.size } });
      if (path === '/api/sessions' && route.request().method() === 'POST') {
        const rows: Session[] = route.request().postDataJSON().sessions;
        submittedChunks.push(rows.length);
        if (submittedChunks.length === 2 && failure === 'http') return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
        const saved = rows.map(row => ({ ...row, id: `db-${row.distance}` }));
        for (const row of saved) committed.set(row.distance, row);
        if (submittedChunks.length === 2) return route.abort('connectionreset');
        return route.fulfill({ json: { sessions: saved } });
      }
      return route.fulfill({ json: { prs: [], awards: [], plans: [], insights: [], chatSessions: [], achievements: [], documents: [], sessions: [], overlaps: [] } });
    });
    const header = 'Time stamp (UTC);Distance (m);Time;Energy (kCal);Stroke count (#);Average power (W);Maximum power (W);Watt per KG;Average split (s);Minimum split (s);Average work (J);Average stroke length (m);Average stroke rate (SPM);Maximum stroke rate (SPM)';
    const rows = Array.from({ length: 26 }, (_, i) => `2026-11-01 10:${String(i).padStart(2, '0')}:00;${1000 + i};317;0;118;87.5;110;1;158;150;0;0;22;24`);
    const file = { name: 'workouts.csv', mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].join('\n')) };
    await page.goto('/sync');
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText('Upload Failed', { exact: true })).toBeVisible();
    await expect(page.getByText(/Some workouts may have been saved.*refreshed from the server/)).toBeVisible();
    await page.getByRole('button', { name: 'Try Again', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText('Upload Successful!', { exact: true })).toBeVisible();
    // Parsing the retry uses the active store: only the uncommitted workout is posted.
    expect(submittedChunks).toEqual(failure === 'http' ? [25, 1, 1] : [25, 1]);
    expect(committed.size).toBe(26);
  });
}


test('timestamp-free detailed CSV uploads and failed ZIP replacement refreshes cached stroke analysis', async ({ page, context }) => {
  const owner = 'stroke-recovery-fixture';
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: owner, role: 'user' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
  let workout: Session = {
    id: 'stroke-recovery', timestamp: new Date('2026-11-01T10:00:00Z'), distance: 1000, duration: 300,
    energy: 0, strokeCount: 6, avgPower: 100, maxPower: 100, wattPerKg: 1, avgSplit: 150,
    minSplit: 150, avgWork: 100, avgStrokeLength: 10, avgStrokeRate: 24, maxStrokeRate: 24,
    strokeData: [], strokeDataCount: 0,
  };
  let posts = 0;
  let detailReads = 0;
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { id: owner }, expires: '2099-01-01' } });
    if (url.pathname === '/api/settings') return route.fulfill({ json: { settings: {} } });
    if (url.pathname === '/api/sessions/list') {
      return route.fulfill({ json: { sessions: [{ ...workout, strokeData: undefined }], count: 1, sessionsRevision: posts } });
    }
    if (url.pathname === '/api/sessions' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(sessionsInput.safeParse(body).success).toBe(true);
      workout = { ...workout, strokeData: body.sessions[0].strokeData, strokeDataCount: body.sessions[0].strokeData.length };
      posts++;
      if (posts === 2) return route.abort('connectionreset');
      return route.fulfill({ json: { sessions: [workout] } });
    }
    if (url.pathname === '/api/sessions' && url.searchParams.has('id')) {
      detailReads++;
      return route.fulfill({ json: { sessions: [workout] } });
    }
    return route.fulfill({ json: { prs: [], awards: [], plans: [], insights: [], chatSessions: [], achievements: [], documents: [], sessions: [], overlaps: [] } });
  });
  const csv = (power: number) => 'Stroke (#);Second (#);Actual power (W);Actual split (s)\n' +
    Array.from({ length: 6 }, (_, i) => `${i + 1};${i + 1};${power};150`).join('\n');
  await page.goto('/sessions/stroke-recovery');
  await page.locator('input[type=file]').setInputFiles({ name: 'strokes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(100)) });
  await expect(page.getByText('Analysis Modules')).toBeVisible();
  expect(posts).toBe(1);
  expect(workout.strokeData?.every(stroke => stroke.timestamp === '')).toBe(true);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('menuitem', { name: 'Sync', exact: true }).click();
  await expect(page).toHaveURL(/\/sync$/);
  const zip = new JSZip();
  zip.file('2026-11-01T100000_1000m.csv', csv(321));
  await page.locator('input[type=file]').setInputFiles({ name: 'strokes.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
  await expect(page.getByText('Upload Failed', { exact: true })).toBeVisible();
  await expect(page.getByText(/Some workouts may have been saved.*refreshed from the server/)).toBeVisible();
  expect(posts).toBe(2);
  const readsBefore = detailReads;
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('menuitem', { name: 'Sessions', exact: true }).click();
  await page.locator('a[href="/sessions/stroke-recovery"]').first().click();
  await expect(page.getByText('Analysis Modules')).toBeVisible();
  await expect.poll(() => detailReads).toBeGreaterThan(readsBefore);
  await expect(page.getByText('Avg Power: 321W', { exact: true })).toBeVisible();
});
