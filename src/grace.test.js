import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGraceStatus } from './grace.js';

test('grace review progresses and resolves to either demo decision', () => {
  assert.equal(advanceGraceStatus('submitted'), 'reviewing');
  assert.equal(advanceGraceStatus('reviewing', () => 0), 'accepted');
  assert.equal(advanceGraceStatus('reviewing', () => 0.5), 'declined');
  for (const status of ['draft', 'submitting', 'failed', 'accepted', 'declined']) {
    assert.equal(advanceGraceStatus(status), status);
  }
});
