import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

const rowingSession = {
  id: "linked-rowing-session",
  timestamp: "2026-05-08T14:30:00.000Z",
  distance: 100,
  duration: 40,
  energy: 4,
  strokeCount: 12,
  avgPower: 100,
  maxPower: 120,
  wattPerKg: 1.4,
  avgSplit: 200,
  minSplit: 190,
  avgWork: 110,
  avgStrokeLength: 8.3,
  avgStrokeRate: 18,
  maxStrokeRate: 20,
  consistencyScore: null,
  createdAt: "2026-05-08T14:31:00.000Z",
  updatedAt: "2026-05-08T14:31:00.000Z",
  importedAt: "2026-05-08T14:31:00.000Z",
  sourceFile: "smartrow.csv",
  strokeData: [],
  mocapSession: { id: "linked-mocap-session" },
};

function stroke(strokeIndex: number) {
  const distance = (strokeIndex + 1) * 10;
  return {
    strokeIndex,
    time: strokeIndex + 1,
    timestamp: `00:${String(strokeIndex + 1).padStart(2, "0")}`,
    distance,
    work: 110 + strokeIndex,
    power: 120 + strokeIndex,
    avgPower: 120,
    split: 150 - strokeIndex,
    avgSplit: 150,
    strokeRate: 24,
    heartRate: null,
    strokeLength: 10,
  };
}

const rowingSessionWithStrokeData = {
  ...rowingSession,
  id: "session-with-strokes",
  strokeData: Array.from({ length: 6 }, (_, index) => stroke(index)),
  strokeDataCount: 6,
  mocapSession: null,
};

async function installAuthenticatedSessionRoutes(
  page: Page,
  sessions: Array<typeof rowingSession | typeof rowingSessionWithStrokeData>,
) {
  const secret = process.env.NEXTAUTH_SECRET;
  test.skip(!secret, "NEXTAUTH_SECRET is required to exercise protected routes");

  const sessionToken = await encode({
    secret: secret!,
    token: {
      id: "user-1",
      email: "rower@example.test",
      role: "user",
    },
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  ]);

  const leanSessions = sessions.map(({ strokeData: _strokeData, ...session }) => ({
    ...session,
    strokeDataCount: Array.isArray(_strokeData)
      ? _strokeData.length
      : (session as { strokeDataCount?: number }).strokeDataCount ?? 0,
  }));

  let detailFetchCount = 0;

  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const searchParams = new URL(route.request().url()).searchParams;

    if (path === "/api/auth/session") {
      return route.fulfill({
        json: {
          user: { id: "user-1", email: "rower@example.test" },
          expires: "2099-01-01T00:00:00.000Z",
        },
      });
    }

    if (path === "/api/sessions/list") {
      return route.fulfill({
        json: {
          sessions: leanSessions,
          sessionsRevision: 1,
          count: leanSessions.length,
        },
      });
    }

    if (path === "/api/sessions") {
      const id = searchParams.get("id");
      detailFetchCount += id ? 1 : 0;
      const selected = id
        ? sessions.filter((session) => session.id === id)
        : sessions;
      return route.fulfill({ json: { sessions: selected } });
    }

    if (path === "/api/settings") {
      return route.fulfill({ json: { settings: {} } });
    }

    if (path === "/api/prs") return route.fulfill({ json: { prs: [] } });
    if (path === "/api/awards") return route.fulfill({ json: { awards: [] } });
    if (path === "/api/training-plans") return route.fulfill({ json: { plans: [] } });
    if (path === "/api/insights") {
      return route.fulfill({
        json: { insights: [], sessionsRevision: 0, insightsRevision: 0 },
      });
    }
    if (path === "/api/chat") return route.fulfill({ json: { chatSessions: [] } });
    if (path === "/api/generated-achievements") {
      return route.fulfill({ json: { achievements: [] } });
    }
    if (path === "/api/memory") return route.fulfill({ json: { documents: [] } });

    return route.continue();
  });

  return {
    getDetailFetchCount: () => detailFetchCount,
  };
}

function trackRechartsDimensionWarnings(page: Page) {
  const warnings: string[] = [];
  const warningPattern = /chart should be greater than 0|width\(-1\)|height\(-1\)/;

  page.on("console", (message) => {
    if (message.type() !== "warning") return;

    const text = message.text();
    if (warningPattern.test(text)) warnings.push(text);
  });

  return warnings;
}

async function expectVisibleChartsToHavePositiveDimensions(page: Page) {
  await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();

  const chartDimensions = await page
    .locator(".recharts-responsive-container")
    .evaluateAll((containers) =>
      containers
        .map((container) => {
          const rect = container.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          };
        })
        .filter((dimension) => dimension.visible),
    );

  expect(chartDimensions.length).toBeGreaterThan(0);
  for (const dimension of chartDimensions) {
    expect(dimension.width).toBeGreaterThan(0);
    expect(dimension.height).toBeGreaterThan(0);
  }
}

test("session detail links to the connected mocap session", async ({ page }) => {
  await installAuthenticatedSessionRoutes(page, [rowingSession]);

  await page.goto("/sessions/linked-rowing-session");

  const mocapLink = page.getByTestId("session-mocap-link");
  await expect(mocapLink).toBeVisible();
  await expect(mocapLink).toHaveAttribute(
    "href",
    "/mocap/sessions/linked-mocap-session",
  );
});

test("session detail uses the selected time zone across midnight", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installAuthenticatedSessionRoutes(page, [{
      ...rowingSession,
      timestamp: "2025-12-31T23:30:00.000Z",
    }]);
    await page.route("**/api/settings", (route) => route.fulfill({
      json: { settings: { timeZone: "Europe/Berlin", dateFormat: "DD/MM/YYYY", timeFormat: "24h" } },
    }));
    await page.goto("/sessions/linked-rowing-session");
    await expect(page.getByText("Thursday, 01/01/2026, 00:30", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("session detail loads stroke data when the session list is lean", async ({ page }) => {
  const routes = await installAuthenticatedSessionRoutes(page, [
    rowingSessionWithStrokeData,
  ]);

  await page.goto("/sessions/session-with-strokes");

  await expect(page.getByText("Analysis Modules")).toBeVisible();
  await expect(page.getByText("Upload Stroke Data")).toHaveCount(0);
  expect(routes.getDetailFetchCount()).toBe(1);
});

test("session detail stroke-analysis charts render without Recharts dimension warnings", async ({
  page,
}) => {
  const rechartsWarnings = trackRechartsDimensionWarnings(page);
  await installAuthenticatedSessionRoutes(page, [rowingSessionWithStrokeData]);

  await page.goto("/sessions/session-with-strokes");

  await expect(page.getByText("Analysis Modules")).toBeVisible();
  await expectVisibleChartsToHavePositiveDimensions(page);

  for (const tabName of ["Performance Graphs", "Segments", "Deep Analysis"]) {
    await page.getByRole("tab", { name: tabName }).click();
    await expect(page.getByRole("tab", { name: tabName })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expectVisibleChartsToHavePositiveDimensions(page);
  }

  expect(rechartsWarnings).toEqual([]);
});

test('linked workout edits show the server unlink instruction without changing the workout', async ({ page }) => {
  await installAuthenticatedSessionRoutes(page, [rowingSessionWithStrokeData, rowingSession]);
  const instruction = 'Unlink the mocap session before modifying stroke data';
  await page.route('**/api/sessions?*', route => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 409, json: { error: instruction } }) : route.fallback());
  await page.route('**/api/sessions', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 409, json: { error: instruction } }) : route.fallback());
  await page.goto('/sessions/session-with-strokes');
  await expect(page.getByText('Analysis Modules')).toBeVisible();
  const messages: string[] = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  for (const action of ['Clear', 'Delete']) {
    await page.getByRole('button', { name: action, exact: true }).click();
    const previousMessages = messages.length;
    await page.getByRole('alertdialog').getByRole('button', { name: action, exact: true }).click();
    await expect.poll(() => messages.length).toBe(previousMessages + 1);
    expect(messages.at(-1)).toBe(instruction);
    await expect(page.getByText('Analysis Modules')).toBeVisible();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  }
  expect(page.url()).toContain('/sessions/session-with-strokes');
  await page.goto('/sessions/linked-rowing-session');
  await page.locator('input[type=file]').setInputFiles({
    name: 'strokes.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Stroke (#);Second (#);Timestamp (UTC);Distance (m);Work (J);Actual power (W);Average power (W);Actual split (s);Average split (s);Stroke rate (SPM)\n1;1;00:01;10;100;100;100;200;200;24'),
  });
  await expect.poll(() => messages.length).toBe(3);
  expect(messages.at(-1)).toBe(instruction);
  await expect(page.getByText('Upload Stroke Data')).toBeVisible();
});
