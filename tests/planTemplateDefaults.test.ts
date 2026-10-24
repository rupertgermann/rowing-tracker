import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './helpers/loadModule';
import type { TrainingPlansService } from '../src/lib/trainingPlans';

test('initial and reset plan selections both have an available template', () => {
  const { trainingPlans } = loadModule<{ trainingPlans: TrainingPlansService }>('src/lib/trainingPlans.ts', {
    '@/lib/dataSync': {},
    '@/lib/memoryStorage': {},
  });
  const page = readFileSync('src/app/plans/page.tsx', 'utf8');
  const selections = [...page.matchAll(/level: '([^']+)'[^\n]*,\s*focus: '([^']+)'/g)];
  assert.equal(selections.length, 2, 'check both initial state and resetForm');
  for (const [, level, focus] of selections) {
    assert(trainingPlans.getTemplates().some(template => template.level === level && template.focus === focus),
      `No template for ${level}/${focus}`);
  }
});
