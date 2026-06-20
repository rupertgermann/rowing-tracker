import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);

const beforePath = args.get("before") ?? "docs/performance/page-load-before.json";
const afterPath = args.get("after") ?? "docs/performance/page-load-after.json";
const outPath = args.get("out") ?? "docs/performance/page-load-report.html";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtMs(value) {
  return `${value.toFixed(1)} ms`;
}

function fmtDelta(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ms`;
}

function pct(value) {
  if (!Number.isFinite(value)) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function routeRows(before, after) {
  const afterByRoute = new Map(after.rows.map((row) => [row.route, row]));
  return before.rows.map((beforeRow) => {
    const afterRow = afterByRoute.get(beforeRow.route);
    const delta = afterRow ? afterRow.median - beforeRow.median : 0;
    const deltaPct = afterRow && beforeRow.median > 0 ? (delta / beforeRow.median) * 100 : 0;

    return {
      route: beforeRow.route,
      before: beforeRow,
      after: afterRow,
      delta,
      deltaPct,
      passedBefore: beforeRow.median <= before.thresholdMs && beforeRow.status < 400 && beforeRow.apiFailures.length === 0,
      passedAfter: afterRow
        ? afterRow.median <= after.thresholdMs && afterRow.status < 400 && afterRow.apiFailures.length === 0
        : false,
    };
  });
}

function statCard(label, value, note) {
  return `
    <section class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </section>
  `;
}

function render() {
  const before = readJson(beforePath);
  const after = readJson(afterPath);
  const rows = routeRows(before, after);
  const slowAfter = rows.filter((row) => !row.passedAfter);
  const improved = rows.filter((row) => row.delta < 0).length;
  const regressed = rows.filter((row) => row.delta > 0).length;
  const maxMedian = Math.max(...rows.map((row) => row.after?.median ?? 0));
  const maxBar = Math.max(...rows.flatMap((row) => [row.before.median, row.after?.median ?? 0, before.thresholdMs, after.thresholdMs]));

  const generatedAt = new Date().toISOString();
  const sessionCount = after.mockMetadata?.sessionCount ?? before.mockMetadata?.sessionCount ?? "unknown";
  const strokeCount = after.mockMetadata?.strokeCount ?? before.mockMetadata?.strokeCount ?? "unknown";

  const bodyRows = rows
    .map((row) => {
      const beforeWidth = Math.max(1, (row.before.median / maxBar) * 100);
      const afterWidth = Math.max(1, ((row.after?.median ?? 0) / maxBar) * 100);
      const status = row.passedAfter ? "PASS" : "FAIL";
      const statusClass = row.passedAfter ? "pass" : "fail";
      const deltaClass = row.delta < 0 ? "better" : row.delta > 0 ? "worse" : "same";

      return `
        <tr>
          <td class="route">${escapeHtml(row.route)}</td>
          <td>
            <div class="bar-cell">
              <span>${fmtMs(row.before.median)}</span>
              <div class="bar-track"><div class="bar before" style="width:${beforeWidth}%"></div></div>
            </div>
          </td>
          <td>
            <div class="bar-cell">
              <span>${row.after ? fmtMs(row.after.median) : "missing"}</span>
              <div class="bar-track"><div class="bar after" style="width:${afterWidth}%"></div></div>
            </div>
          </td>
          <td class="${deltaClass}">${fmtDelta(row.delta)} <small>${pct(row.deltaPct)}</small></td>
          <td>${row.after ? fmtMs(row.after.p95) : "missing"}</td>
          <td><span class="pill ${statusClass}">${status}</span></td>
        </tr>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rowing Tracker Page Load Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7faf9;
      --panel: #ffffff;
      --ink: #12211d;
      --muted: #64746f;
      --line: #dce7e3;
      --before: #94a3b8;
      --after: #0f766e;
      --good: #0f766e;
      --bad: #b42318;
      --warn: #b45309;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(1180px, calc(100vw - 40px));
      margin: 0 auto;
      padding: 36px 0 48px;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 32px;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: var(--muted);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 12px;
      background: var(--panel);
      color: var(--muted);
      white-space: nowrap;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      min-height: 112px;
    }

    .stat-card span,
    .stat-card small {
      display: block;
      color: var(--muted);
    }

    .stat-card strong {
      display: block;
      margin: 8px 0 4px;
      font-size: 28px;
      letter-spacing: 0;
    }

    .summary {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }

    th,
    td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: #eef5f2;
    }

    tr:last-child td { border-bottom: 0; }
    .route { font-weight: 650; white-space: nowrap; }

    .bar-cell {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 10px;
      align-items: center;
      min-width: 190px;
    }

    .bar-track {
      height: 8px;
      background: #edf2f0;
      border-radius: 999px;
      overflow: hidden;
    }

    .bar {
      height: 100%;
      border-radius: inherit;
    }

    .bar.before { background: var(--before); }
    .bar.after { background: var(--after); }

    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 56px;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 12px;
      font-weight: 800;
    }

    .pill.pass {
      background: #dff7ee;
      color: var(--good);
    }

    .pill.fail {
      background: #fee4e2;
      color: var(--bad);
    }

    .better { color: var(--good); font-weight: 700; }
    .worse { color: var(--bad); font-weight: 700; }
    .same { color: var(--muted); font-weight: 700; }
    td small { color: var(--muted); font-weight: 500; }

    @media (max-width: 900px) {
      header,
      .stats { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Rowing Tracker Page Load Report</h1>
        <p>Before and after optimization, measured with seeded mock data and the same benchmark conditions.</p>
      </div>
      <div class="badge">Generated ${escapeHtml(generatedAt)}</div>
    </header>

    <section class="stats">
      ${statCard("Pages measured", String(rows.length), `${slowAfter.length} over threshold after optimization`)}
      ${statCard("Seeded data", `${sessionCount} sessions`, `${strokeCount} stroke rows`)}
      ${statCard("After max median", fmtMs(maxMedian), `Threshold ${fmtMs(after.thresholdMs)}`)}
      ${statCard("Changed routes", `${improved} faster / ${regressed} slower`, "Median comparison")}
    </section>

    <section class="summary">
      <p><strong>Conditions:</strong> mode=${escapeHtml(after.mode)}, base=${escapeHtml(after.baseUrl)}, warmups=${after.warmups}, samples=${after.samples}, user=${escapeHtml(after.benchmarkUserId)}.</p>
      <p><strong>Before:</strong> ${escapeHtml(before.generatedAt)}. <strong>After:</strong> ${escapeHtml(after.generatedAt)}.</p>
    </section>

    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Before median</th>
          <th>After median</th>
          <th>Delta</th>
          <th>After p95</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, render());
console.log(`Wrote ${outPath}`);
