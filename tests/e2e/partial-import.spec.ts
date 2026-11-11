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
