import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';

function rootPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && /^\([^)]+\)$/.test(entry.name)) return rootPages(file);
    return entry.isFile() && /^page\.(tsx?|jsx?)$/.test(entry.name) ? [file] : [];
  });
}

test('the root URL has one page and redirects to the active dashboard', () => {
  const pages = rootPages('src/app');
  assert.equal(pages.length, 1, `Pages resolving to /: ${pages.join(', ')}`);
  const redirected = new Error('dashboard redirect');
  const { default: Home } = loadModule<{ default: () => void }>(pages[0], {
    'next/navigation': {
      redirect(destination: string) {
        assert.equal(destination, '/dashboard');
        throw redirected;
      },
    },
  });
  assert.throws(() => Home(), error => error === redirected);
});
