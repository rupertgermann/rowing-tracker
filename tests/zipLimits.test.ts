import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { processZipFile } from '../src/lib/zipParser';

test('ZIP parser rejects oversized expanded CSV before parsing', async () => {
  const zip = new JSZip().file('2026-01-01T000000_2000m.csv', 'x'.repeat(8 * 1024 * 1024 + 1));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const file = Object.assign(bytes, { size: bytes.length, arrayBuffer: async () => bytes.buffer }) as unknown as File;
  const result = await processZipFile(file, [{ id: 'a', timestamp: new Date('2026-01-01T00:00:00Z'), distance: 2000 } as never]);
  assert.match(result.errors.join(' '), /expanded.*limit/i);
  assert.equal(result.sessionsToSave.length, 0);
});

test('ZIP parser rejects excessive entries and compressed bytes before extracting files', async () => {
  const zip = new JSZip();
  for (let i = 0; i < 2001; i++) zip.file(`${i}.txt`, '');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const result = await processZipFile(new File([new Uint8Array(bytes)], 'many.zip'), []);
  assert.match(result.errors.join(' '), /entry limit/);
  const huge = await processZipFile(new File([new Uint8Array(32 * 1024 * 1024 + 1)], 'huge.zip'), []);
  assert.match(huge.errors.join(' '), /compressed size limit/);
});

class TestFileReader {
  result: string | null = null;
  onload: ((event: { target: TestFileReader }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsText(file: Blob) {
    file.text().then(text => { this.result = text; this.onload?.({ target: this }); }).catch(error => this.onerror?.(error));
  }
}
Object.defineProperty(globalThis, 'FileReader', { value: TestFileReader, configurable: true });

test('ZIP parser preserves a normal detailed CSV import', async () => {
  const csv = 'Stroke (#);Second (#);Timestamp (UTC);Distance (m);Work (J);Actual power (W);Average power (W);Actual split (s);Average split (s);Stroke rate (SPM)\n1;2;00:02;8;100;150;150;120;120;30';
  const zip = new JSZip().file('2026-01-01T000000_2000m.csv', csv);
  const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'normal.zip');
  const result = await processZipFile(file, [{ id: 'a', timestamp: new Date('2026-01-01T00:00:00Z'), distance: 2000 } as never]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.sessionsToSave[0].strokeData?.[0].power, 150);
});

test('ZIP expanded budget is cumulative across entries', async () => {
  const zip = new JSZip();
  for (let i = 0; i < 9; i++) zip.file(`${i}/2026-01-01T000000_2000m.csv`, 'Stroke (#);Second (#);Actual power (W)\n' + ' '.repeat(8 * 1024 * 1024 - 38));
  const file = new File([await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })], 'many.zip');
  const result = await processZipFile(file, [{ id: 'a', timestamp: new Date('2026-01-01T00:00:00Z'), distance: 2000 } as never]);
  assert.match(result.errors.join(' '), /64 MiB/);
  assert.equal(result.sessionsToSave.length, 0);
});
