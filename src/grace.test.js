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

test('accepted decisions update payment once; declined, pending and terminal requests preserve it', async () => {
  const { advanceGraceRequest } = await import('./grace.js');
  const support = { id: 'test', status: 'reviewing' };
  const payment = { amount: 2500, date: '2026-11-13' };
  const accepted = advanceGraceRequest(support, payment, '2026-11-08', () => 0);
  assert.equal(accepted.support.status, 'accepted');
  assert.equal(accepted.support.paymentDate, '2026-11-27');
  assert.deepEqual(accepted.payment, { amount: 2500, date: '2026-11-27' });
  assert.deepEqual(payment, { amount: 2500, date: '2026-11-13' });
  assert.equal(support.status, 'reviewing');
  const repeated = advanceGraceRequest(accepted.support, accepted.payment, '2026-11-08', () => assert.fail('must not reroll'));
  assert.equal(repeated.support, accepted.support);
  assert.equal(repeated.payment, accepted.payment);
  assert.equal(advanceGraceRequest(support, payment, '2026-11-08', () => 1).payment, payment);
  assert.equal(advanceGraceRequest({ ...support, status: 'submitted' }, payment, '2026-11-08').payment, payment);
  const missing = advanceGraceRequest(support, null, '2026-11-08', () => 0);
  assert.equal(missing.support.status, 'accepted');
  assert.equal(missing.support.paymentDate, null);
  assert.equal(missing.payment, null);
});
