import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test('hosted chat and settings expose no key entry or provider requests', async ({ page, context }) => {
  test.skip(process.env.NEXT_PUBLIC_AI_MODE === 'personal', 'Run against a default hosted build');
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: 'hosted-test', role: 'user' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }]);
  let providerRequests = 0;
  await context.route('https://api.openai.com/**', route => { providerRequests++; return route.abort(); });
  await context.route('**/api/**', route => {
    if (route.request().url().includes('/api/auth/session')) return route.fulfill({ json: { user: { id: 'hosted-test' }, expires: '2099-01-01' } });
    return route.fulfill({ json: { settings: {}, sessions: [], documents: [] } });
  });
  await page.goto('/chat');
  await expect(page.getByRole('heading', { name: 'Hosted AI unavailable' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('button', { name: /AI Settings Configure/ }).click();
  await expect(page.getByText('Hosted AI unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenAI API Key', { exact: true })).toHaveCount(0);
  expect(providerRequests).toBe(0);
});
