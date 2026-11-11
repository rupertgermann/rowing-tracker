import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import type * as DateTimeUtils from '../src/lib/dateTimeUtils';

for (const timeZone of ['Europe/Berlin', 'America/Los_Angeles']) {
  test(`date labels consistently use ${timeZone} across a year boundary`, () => {
    const preferences = { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', timeZone };
    const dates = loadModule<typeof DateTimeUtils>('src/lib/dateTimeUtils.ts', {
      './settings': { SettingsService: { getInstance: () => ({ getUserPreferences: () => preferences }) } },
    });
    const berlin = timeZone === 'Europe/Berlin';
    const instant = berlin ? '2025-12-31T23:30:00Z' : '2026-01-01T00:30:00Z';
    assert.equal(dates.formatDate(instant), berlin ? '1 Jan 2026' : '31 Dec 2025');
    assert.equal(dates.formatSessionDetailDate(instant), berlin
      ? 'Thursday, 01/01/2026, 00:30'
      : 'Wednesday, 31/12/2025, 16:30');
    assert.equal(dates.formatChartDate(instant), berlin ? '1 Jan' : '31 Dec');
    assert.equal(dates.formatMonthYear(instant), berlin ? 'January 2026' : 'December 2025');
    preferences.dateFormat = 'YYYY-MM-DD';
    assert.equal(dates.formatDate(instant, { shortMonth: false }), berlin ? '2026-01-01' : '2025-12-31');
    preferences.dateFormat = 'MM/DD/YYYY';
    assert.equal(dates.formatDate(instant, { shortMonth: false }), berlin ? '01/01/2026' : '12/31/2025');
  });
}
