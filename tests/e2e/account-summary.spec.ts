import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test('summary download discloses omissions before download or clearing data', async ({ page, context }) => {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: 'summary-fixture', role: 'user' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
  let deleted = false;
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE' || path === '/api/user/delete') deleted = true;
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'summary-fixture', name: 'Summary fixture' }, expires: '2099-01-01' } });
    if (path === '/api/settings') return route.fulfill({ json: { settings: {} } });
    if (path === '/api/user/export') return route.fulfill({ headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="rowing-tracker-summary-fixture.json"' }, body: '{"exportFormat":"Rowing Tracker limited summary"}' });
    return route.fulfill({ json: { insights: [], sessions: [], documents: [], count: 0 } });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: /Data Management/ }).click();
  await expect(page.getByText('This is a limited summary, not a backup.', { exact: false })).toBeVisible();
  await expect(page.getByText('Mocap sessions, pose streams, video, posture metrics and faults', { exact: true })).toBeVisible();
  await expect(page.getByText(/Other memory fields, including structured content/)).toBeVisible();
  await expect(page.getByText(/Other stroke fields: IDs, time, work/)).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download account summary (JSON)' }).click();
  expect((await downloaded).suggestedFilename()).toBe('rowing-tracker-summary-fixture.json');
  await page.getByRole('button', { name: /Clear Sessions/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText(/cannot restore your account/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(deleted).toBe(false);
});
