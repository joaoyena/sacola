import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePurchaseCommissions,
  MAXIMUM_COMMISSION_PURCHASE,
  MINIMUM_COMMISSION_PURCHASE,
} from './commission.js';

test('awards 10%, 6%, and 2% on the first eligible purchase', () => {
  assert.deepEqual(calculatePurchaseCommissions(10_000, true), [
    { level: 1, rate: 0.1, amount: 1_000 },
    { level: 2, rate: 0.06, amount: 600 },
    { level: 3, rate: 0.02, amount: 200 },
  ]);
});

test('includes both configured purchase limits', () => {
  assert.equal(calculatePurchaseCommissions(MINIMUM_COMMISSION_PURCHASE, true)[0].amount, 300);
  assert.equal(
    calculatePurchaseCommissions(MAXIMUM_COMMISSION_PURCHASE, true)[0].amount,
    280_000,
  );
});

test('does not award commissions outside the purchase limits or after the first purchase', () => {
  assert.deepEqual(calculatePurchaseCommissions(MINIMUM_COMMISSION_PURCHASE - 1, true), []);
  assert.deepEqual(calculatePurchaseCommissions(MAXIMUM_COMMISSION_PURCHASE + 1, true), []);
  assert.deepEqual(calculatePurchaseCommissions(10_000, false), []);
});
