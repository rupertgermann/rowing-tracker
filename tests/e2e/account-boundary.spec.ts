import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';

async function fixture(context: BrowserContext) {
  let owner: string | null = 'A';
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: 'A', role: 'user' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: owner ? { user: { id: owner, name: `Rower ${owner}`, email: `${owner}@example.test` }, expires: '2099-01-01' } : {} });
    if (path === '/api/auth/csrf') return route.fulfill({ json: { csrfToken: 'synthetic' } });
    if (path === '/api/auth/signout') { owner = null; return route.fulfill({ json: { url: '/auth/login' } }); }
    if (path === '/api/settings') return route.fulfill({ json: { settings: {} } });
    if (path === '/api/sessions/list') return route.fulfill({ json: { sessions: [], count: 1, sessionsRevision: 1 } });
    if (path === '/api/analytics') {
      const distance = owner === 'A' ? 1111 : 2222;
      const point = { date: 'Nov 11', fullDate: new Date().toISOString(), sessionId: owner, value: distance };
      return route.fulfill({ json: { chartData: { distance: [point], duration: [], power: [], pace: [], energy: [], strokeRate: [], splitTime: [], consistencyScore: [] }, summary: { totalDistance: distance, sessionCount: 1 }, scatterData: [], availableDates: [], sessionCount: 1, sessionsRevision: 1 } });
    }
    return route.fulfill({ json: { trends: [], sessionsAnalyzed: 0, prs: [], awards: [], plans: [], insights: [], chatSessions: [], achievements: [], documents: [], sessions: [] } });
  });
  return { switchTo: (next: string | null) => { owner = next; } };
}

async function refreshSession(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

async function seedAI(page: Page) {
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rowing_app_settings'))).not.toBeNull();
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('rowing_app_settings')!);
    settings.aiSettings.cloudAIEnabled = true;
    settings.aiSettings.openaiApiKey = 'sk-synthetic-account-A-1111';
    localStorage.setItem('rowing_app_settings', JSON.stringify(settings));
  });
}

test('same-tab and cross-tab account switch replaces equal-revision analytics and AI settings', async ({ page, context }) => {
  const auth = await fixture(context);
  await page.goto('/analytics');
  await expect(page.getByText('1.1km', { exact: true })).toBeVisible();
  await seedAI(page);
  const other = await context.newPage();
  await other.goto('/settings');
  await other.getByRole('button', { name: /AI Settings Configure/ }).click();
  await expect(other.getByText('sk-...1111', { exact: true })).toBeVisible();
  const staleAnalytics = await page.evaluate(() => localStorage.getItem('rowing_analytics_cache'));
  let capture!: (route: Route) => void;
  const pending = new Promise<Route>(resolve => { capture = resolve; });
  await page.route('**/api/analytics', route => capture(route), { times: 1 });
  await page.getByRole('button', { name: 'Refresh Data' }).click();
  const oldRequest = await pending;
  auth.switchTo('B');
  await refreshSession(page);
  await expect(page.getByText('2.2km', { exact: true })).toBeVisible();
  await expect(page.getByText('1.1km', { exact: true })).toHaveCount(0);
  await oldRequest.fulfill({ body: staleAnalytics!, contentType: 'application/json' });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rowing_analytics_cache')!).summary.totalDistance)).toBe(2222);
  await expect.poll(() => other.evaluate(() => localStorage.getItem('rowing_account_owner'))).toBe('B');
  await expect(other.getByText('sk-...1111', { exact: true })).toHaveCount(0);
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('rowing_app_settings') ?? '{}').aiSettings?.openaiApiKey ?? '')).toBe('');
});

test('session expiry clears account state and logout uses the same boundary', async ({ page, context }) => {
  const auth = await fixture(context);
  await page.goto('/analytics');
  await expect(page.getByText('1.1km', { exact: true })).toBeVisible();
  auth.switchTo(null);
  await refreshSession(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rowing_account_owner')).catch(() => undefined)).toBe('');
  await expect(page.getByText('1.1km', { exact: true })).toHaveCount(0);
  auth.switchTo('B');
  await refreshSession(page);
  await page.goto('/analytics');
  await expect(page.getByText('2.2km', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rowing_account_owner')).catch(() => undefined)).toBe('');
  await expect(page.getByText('2.2km', { exact: true })).toHaveCount(0);
});
