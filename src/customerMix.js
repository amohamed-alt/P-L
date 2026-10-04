const SEGMENTS = ['Acquisition', 'Retention', 'Total'];

function numeric(value, label, integer = false) {
  if (value === null || value === undefined || String(value).trim() === '') throw new Error(`Missing ${label}.`);
  const text = String(value).trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`Invalid ${label}.`);
  const result = Number(text);
  if (!Number.isFinite(result) || (integer && (!Number.isInteger(result) || result < 0))) throw new Error(`Invalid ${label}.`);
  return result;
}

export function validateCustomerMix(input) {
  if (!input || !Array.isArray(input.columns) || input.columns.length !== 2 || !Array.isArray(input.rows) || input.rows.length !== 3) throw new Error('Invalid acquisition and retention summary.');
  const columns = input.columns.map((column) => {
    const year = numeric(column.year, 'year', true);
    const throughMonth = numeric(column.throughMonth, 'month', true);
    if (year < 2000 || year > 2100 || throughMonth < 1 || throughMonth > 12) throw new Error('Invalid summary period.');
    return { year, throughMonth };
  });
  if (columns[0].year === columns[1].year) throw new Error('Summary years must differ.');
  const rows = SEGMENTS.map((segment, index) => {
    const row = input.rows[index];
    if (row.segment !== segment || !Array.isArray(row.values) || row.values.length !== 2) throw new Error(`Missing ${segment} summary.`);
    return { segment, values: row.values.map((value) => ({ amount: numeric(value.amount, 'amount') })) };
  });
  for (let index = 0; index < 2; index += 1) {
    const sum = rows[0].values[index].amount + rows[1].values[index].amount;
    if (Math.abs(sum - rows[2].values[index].amount) > 0.02) throw new Error('Summary amounts do not reconcile.');
  }
  if (!input.updatedAt || !Number.isFinite(Date.parse(input.updatedAt))) throw new Error('Missing summary update timestamp.');
  return { ...input, columns, rows };
}

export function parseCustomerMix(values, updatedAt = new Date().toISOString()) {
  if (!Array.isArray(values) || values.length < 6) throw new Error('Ret/Acq!A1:E6 is incomplete.');
  if (values[0][0] !== 'Month' || values[1][0] !== 'Year' || values[2][1] !== 'Amount' || values[2][2] !== 'Unique Customers' || values[2][3] !== 'Amount' || values[2][4] !== 'Unique Customers') throw new Error('Ret/Acq headers have changed.');
  if (Number(values[0][1]) !== Number(values[0][2]) || Number(values[0][3]) !== Number(values[0][4]) || Number(values[1][1]) !== Number(values[1][2]) || Number(values[1][3]) !== Number(values[1][4])) throw new Error('Summary amount and customer periods do not match.');
  return validateCustomerMix({
    sourceSheet: 'Ret/Acq', metric: 'booking', updatedAt,
    columns: [1, 3].map((index) => ({ year: values[1][index], throughMonth: values[0][index] })),
    rows: values.slice(3, 6).map((row) => ({ segment: row[0], values: [1, 3].map((index) => ({ amount: row[index] })) })),
  });
}
