import assert from 'node:assert/strict';
import { parseCustomerMix } from '../src/customerMix.js';

const grid = [['Month', 10, 10, 10, 10], ['Year', 2026, 2026, 2025, 2025], [null, 'Amount', 'Unique Customers', 'Amount', 'Unique Customers'], ['Acquisition', 100, 2, 80, 3], ['Retention', 200, 4, 160, 6], ['Total', 300, 6, 240, 9]];
assert.equal(parseCustomerMix(grid).rows[2].values[0].amount, 300);
for (const value of ['', null, '#REF!', 'foo']) {
  const copy = structuredClone(grid);
  copy[3][1] = value;
  assert.throws(() => parseCustomerMix(copy));
}
const zero = structuredClone(grid);
zero[3][1] = 0; zero[5][1] = 200;
assert.equal(parseCustomerMix(zero).rows[0].values[0].amount, 0);
const mismatch = structuredClone(grid); mismatch[0][2] = 9;
assert.throws(() => parseCustomerMix(mismatch));
const totals = structuredClone(grid); totals[5][1] = 301;
assert.throws(() => parseCustomerMix(totals));
console.log('Customer mix parsing and validation passed.');
