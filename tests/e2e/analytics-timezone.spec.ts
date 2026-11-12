import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test('cached analytics and session detail follow the current date preferences at year boundary', async ({ page, context }) => {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: 'timezone-rower', role: 'user' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
  const session = { id: 'year-boundary', timestamp: '2025-12-31T23:30:00.000Z', distance: 1000, duration: 300, energy: 50, avgPower: 100, avgSplit: 150, avgStrokeRate: 24, avgStrokeLength: 8, strokeCount: 120, strokeData: [], consistencyScore: null };
  let zone = 'Europe/Berlin';
  let dateFormat = 'MM/DD/YYYY';
  let analyticsRequests = 0;
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'timezone-rower' }, expires: '2099-01-01' } });
    if (path === '/api/settings') return route.fulfill({ json: { settings: { timeZone: zone, dateFormat, timeFormat: '24h' } } });
    if (path === '/api/sessions/list') return route.fulfill({ json: { sessions: [session], count: 1, sessionsRevision: 1 } });
    if (path === '/api/sessions') return route.fulfill({ json: { sessions: [session] } });
    if (path === '/api/analytics') {
      analyticsRequests++;
      const point = { date: 'Dec 31', fullDate: session.timestamp, sessionId: session.id };
      return route.fulfill({ json: { chartData: { distance: [{ ...point, value: 1000 }], duration: [{ ...point, value: 300 }], power: [], pace: [], energy: [], strokeRate: [], consistencyScore: [] }, summary: { totalDistance: 1000, sessionCount: 1 }, scatterData: [{ sessionId: session.id, date: 'Dec 31', distance: 1000, power: 100, duration: 300, durationMinutes: 5, pace: 150, strokeRate: 24, energy: 50, strokeLength: 8 }], availableDates: [session.timestamp], sessionCount: 1, sessionsRevision: 1 } });
    }
    return route.fulfill({ json: { trends: [], sessionsAnalyzed: 0, prs: [], awards: [], plans: [], insights: [], chatSessions: [], achievements: [], documents: [], sessions: [] } });
  });
  await page.goto('/analytics');
  await page.getByRole('button', { name: 'Filter to All Time', exact: true }).first().click();
  await expect(page.locator('.recharts-wrapper').getByText('Jan 1', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rowing_analytics_cache'))).not.toBeNull();
  const initialRequests = analyticsRequests;
  await page.goto('/sessions/year-boundary');
  await expect(page.getByText('Thursday, 01/01/2026, 00:30', { exact: true })).toBeVisible();
  zone = 'America/New_York';
  dateFormat = 'DD/MM/YYYY';
  await page.reload();
  await expect(page.getByText('Wednesday, 31/12/2025, 18:30', { exact: true })).toBeVisible();
  await page.goto('/analytics');
  await expect(page.locator('.recharts-wrapper').getByText('31 Dec', { exact: true }).first()).toBeVisible();
  expect(analyticsRequests).toBe(initialRequests);
});
