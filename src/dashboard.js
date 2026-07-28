export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SOURCE_METRICS = ['booking', 'cashing', 'cogs', 'overheads', 'support'];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function deriveRow(input = {}) {
  const booking = number(input.booking);
  const cashing = number(input.cashing);
  const cogs = number(input.cogs);
  const overheads = number(input.overheads);
  const support = number(input.supportAllocation ?? input.support);
  const totalCost = Number.isFinite(Number(input.totalCost)) ? Number(input.totalCost) : cogs + overheads + support;
  const operatingResult = Number.isFinite(Number(input.operatingResult)) ? Number(input.operatingResult) : booking - totalCost;
  const cashGap = Number.isFinite(Number(input.cashGap)) ? Number(input.cashGap) : cashing - totalCost;
  return {
    ...input,
    year: number(input.year),
    monthNumber: number(input.monthNumber),
    month: input.month || MONTH_NAMES[number(input.monthNumber) - 1] || '',
    monthShort: input.monthShort || MONTHS[number(input.monthNumber) - 1] || '',
    booking,
    cashing,
    cogs,
    overheads,
    support,
    supportAllocation: support,
    totalCost,
    operatingResult,
    cashGap,
    cashCoverage: Number.isFinite(Number(input.cashCoverage)) ? Number(input.cashCoverage) : safeDivide(cashing, totalCost),
    bookingToCash: Number.isFinite(Number(input.bookingToCash)) ? Number(input.bookingToCash) : safeDivide(cashing, booking),
    hasMeaningfulData: input.hasMeaningfulData === true || SOURCE_METRICS.some((metric) => {
      if (metric === 'support') return support !== 0;
      return number(input[metric]) !== 0;
    }),
    isPartial: input.isPartial === true || input.status === 'partial',
    status: input.status || (input.isPartial ? 'partial' : 'closed'),
  };
}

export function normalizeDashboard(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.monthlyData)) {
    throw new Error('The dashboard data is missing or invalid.');
  }
  const rows = payload.monthlyData.map(deriveRow).filter((row) => row.year && row.monthNumber >= 1 && row.monthNumber <= 12);
  const years = [...new Set([
    ...(Array.isArray(payload.metadata?.reportingYears) ? payload.metadata.reportingYears.map(number) : []),
    ...rows.map((row) => row.year),
  ].filter(Boolean))].sort((a, b) => a - b);
  if (!years.length) throw new Error('No reporting years are available.');

  const rowMap = new Map(rows.map((row) => [`${row.year}-${row.monthNumber}`, row]));
  return {
    raw: payload,
    metadata: payload.metadata || {},
    dataQuality: payload.dataQuality || {},
    totalsByYear: payload.totalsByYear || {},
    years,
    rows,
    rowMap,
    currency: payload.metadata?.currency || 'USD',
  };
}

export function defaultFilters(data) {
  const comparisonYear = number(data.metadata.currentReportingYear) || data.years.at(-1);
  const baselineYear = number(data.metadata.previousReportingYear) || data.years.findLast((year) => year < comparisonYear) || data.years[0];
  const latest = Math.max(1, Math.min(12, number(data.metadata.latestDataMonthNumber) || 12));
  return {
    baselineYear,
    comparisonYear,
    mode: 'available',
    startMonth: 0,
    endMonth: latest - 1,
    includePartial: true,
    fullYearContext: true,
    metricFocus: 'commercial',
  };
}

export function getRow(data, year, monthIndex) {
  return data.rowMap.get(`${year}-${monthIndex + 1}`) || deriveRow({ year, monthNumber: monthIndex + 1 });
}

export function selectedIndexes(data, filters) {
  const start = Math.max(0, Math.min(11, Math.min(filters.startMonth, filters.endMonth)));
  let end = Math.max(0, Math.min(11, Math.max(filters.startMonth, filters.endMonth)));
  if (filters.mode === 'available') {
    const latest = number(data.metadata.latestDataMonthNumber);
    if (latest >= 1) end = Math.min(end, latest - 1);
  }
  if (filters.mode === 'closed') {
    const closed = number(data.metadata.closedMonthNumber);
    if (closed >= 1) end = Math.min(end, closed - 1);
  }
  const indexes = [];
  for (let index = start; index <= end; index += 1) {
    const comparisonRow = getRow(data, filters.comparisonYear, index);
    if (!filters.includePartial && comparisonRow.isPartial) continue;
    indexes.push(index);
  }
  return indexes;
}

export function displayIndexes(filters) {
  if (filters.fullYearContext) return MONTHS.map((_, index) => index);
  const start = Math.max(0, Math.min(11, Math.min(filters.startMonth, filters.endMonth)));
  const end = Math.max(0, Math.min(11, Math.max(filters.startMonth, filters.endMonth)));
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

export function aggregateYear(data, year, indexes) {
  const availableRows = indexes.map((index) => getRow(data, year, index)).filter((row) => row.hasMeaningfulData);
  const totals = availableRows.reduce((accumulator, row) => ({
    booking: accumulator.booking + row.booking,
    cashing: accumulator.cashing + row.cashing,
    cogs: accumulator.cogs + row.cogs,
    overheads: accumulator.overheads + row.overheads,
    support: accumulator.support + row.support,
    totalCost: accumulator.totalCost + row.totalCost,
    operatingResult: accumulator.operatingResult + row.operatingResult,
    cashGap: accumulator.cashGap + row.cashGap,
  }), { booking: 0, cashing: 0, cogs: 0, overheads: 0, support: 0, totalCost: 0, operatingResult: 0, cashGap: 0 });

  return {
    ...totals,
    cashCoverage: safeDivide(totals.cashing, totals.totalCost),
    bookingToCash: safeDivide(totals.cashing, totals.booking),
    availableMonthCount: availableRows.length,
    requestedMonthCount: indexes.length,
    completeForPeriod: indexes.length > 0 && availableRows.length === indexes.length,
  };
}

export function buildSnapshot(data, filters) {
  const indexes = selectedIndexes(data, filters);
  return {
    indexes,
    periodLabel: indexes.length ? `${MONTHS[indexes[0]]}–${MONTHS[indexes.at(-1)]}` : 'No period',
    baseline: aggregateYear(data, filters.baselineYear, indexes),
    comparison: aggregateYear(data, filters.comparisonYear, indexes),
  };
}

export function variance(current, prior) {
  const absolute = current - prior;
  return {
    absolute,
    percent: prior ? absolute / Math.abs(prior) : null,
  };
}

export function statusFor(metric, current, prior) {
  const change = variance(current, prior);
  if (change.percent === null) return 'neutral';
  const lowerIsBetter = ['totalCost', 'cogs', 'overheads', 'support'].includes(metric);
  const score = lowerIsBetter ? -change.percent : change.percent;
  if (score > 0.025) return 'positive';
  if (score < -0.025) return 'negative';
  return 'neutral';
}

export function buildMonthlyRows(data, filters) {
  const selected = new Set(selectedIndexes(data, filters));
  return displayIndexes(filters).map((index) => {
    const baseline = getRow(data, filters.baselineYear, index);
    const comparison = getRow(data, filters.comparisonYear, index);
    return {
      month: MONTHS[index],
      monthNumber: index + 1,
      selected: selected.has(index),
      baseline,
      comparison,
      bookingBaseline: baseline.hasMeaningfulData ? baseline.booking : null,
      bookingComparison: comparison.hasMeaningfulData ? comparison.booking : null,
      cashingBaseline: baseline.hasMeaningfulData ? baseline.cashing : null,
      cashingComparison: comparison.hasMeaningfulData ? comparison.cashing : null,
      costBaseline: baseline.hasMeaningfulData ? baseline.totalCost : null,
      costComparison: comparison.hasMeaningfulData ? comparison.totalCost : null,
      cashCoverageBaseline: baseline.hasMeaningfulData ? baseline.cashCoverage : null,
      cashCoverageComparison: comparison.hasMeaningfulData ? comparison.cashCoverage : null,
      bookingToCashBaseline: baseline.hasMeaningfulData ? baseline.bookingToCash : null,
      bookingToCashComparison: comparison.hasMeaningfulData ? comparison.bookingToCash : null,
    };
  });
}

export function generateInsights(data, filters, snapshot) {
  const items = [];
  const booking = variance(snapshot.comparison.booking, snapshot.baseline.booking);
  const cashing = variance(snapshot.comparison.cashing, snapshot.baseline.cashing);
  const cost = variance(snapshot.comparison.totalCost, snapshot.baseline.totalCost);
  const coverage = variance(snapshot.comparison.cashCoverage || 0, snapshot.baseline.cashCoverage || 0);

  if (booking.percent !== null) items.push({
    tone: booking.percent >= 0 ? 'positive' : 'negative',
    title: `Booking ${booking.percent >= 0 ? 'increased' : 'declined'} versus ${filters.baselineYear}`,
    detail: `${Math.abs(booking.percent * 100).toFixed(1)}% movement across ${snapshot.periodLabel}.`,
  });
  if (cashing.percent !== null) items.push({
    tone: cashing.percent >= 0 ? 'positive' : 'negative',
    title: `Cash collection ${cashing.percent >= 0 ? 'improved' : 'softened'}`,
    detail: `${Math.abs(cashing.percent * 100).toFixed(1)}% year-over-year movement in the selected period.`,
  });
  if (cost.percent !== null) items.push({
    tone: cost.percent <= 0 ? 'positive' : 'warning',
    title: `Total cost ${cost.percent <= 0 ? 'is lower' : 'is higher'} than baseline`,
    detail: `${Math.abs(cost.percent * 100).toFixed(1)}% variance, driven by COGS, overheads and support allocation.`,
  });
  items.push({
    tone: snapshot.comparison.cashGap >= 0 ? 'positive' : 'negative',
    title: snapshot.comparison.cashGap >= 0 ? 'Cash fully covers the selected-period cost' : 'A cash funding gap remains',
    detail: `Cashing minus total cost is ${snapshot.comparison.cashGap >= 0 ? 'positive' : 'negative'} for ${filters.comparisonYear}.`,
  });
  if (coverage.percent !== null) items.push({
    tone: coverage.percent >= 0 ? 'positive' : 'warning',
    title: `Cash coverage ${coverage.percent >= 0 ? 'strengthened' : 'weakened'}`,
    detail: `${Math.abs(coverage.absolute * 100).toFixed(1)} percentage-point movement versus ${filters.baselineYear}.`,
  });
  if (!snapshot.comparison.completeForPeriod) items.push({
    tone: 'warning',
    title: 'Comparison period contains incomplete data',
    detail: `${snapshot.comparison.availableMonthCount} of ${snapshot.comparison.requestedMonthCount} selected months contain meaningful comparison-year data.`,
  });
  return items.slice(0, 6);
}

export function calculateForecast(actualData, payload) {
  if (!payload || !Array.isArray(payload.booking) || !Array.isArray(payload.cashing)) {
    throw new Error('Forecast data is missing or invalid.');
  }
  const year = number(payload.metadata?.year);
  const actualThroughIndex = number(payload.metadata?.actualThroughMonthNumber) - 1;
  const forecastStartIndex = number(payload.metadata?.forecastStartMonthNumber) - 1;
  const forecastEndIndex = number(payload.metadata?.forecastEndMonthNumber) - 1;
  const sumRows = (rows) => rows[0]?.monthly?.map((_, index) => rows.reduce((total, row) => total + number(row.monthly?.[index]), 0)) || [];
  const bookingForecast = sumRows(payload.booking);
  const cashingForecast = sumRows(payload.cashing);
  const annualCost = number(payload.costPlan?.annualCost);
  const monthlyCost = annualCost / 12;

  const monthly = MONTHS.map((month, index) => {
    const actual = getRow(actualData, year, index);
    const isActual = index <= actualThroughIndex;
    const isForecast = index >= forecastStartIndex && index <= forecastEndIndex;
    const offset = index - forecastStartIndex;
    const booking = isActual ? actual.booking : isForecast ? number(bookingForecast[offset]) : 0;
    const cashing = isActual ? actual.cashing : isForecast ? number(cashingForecast[offset]) : 0;
    return {
      month,
      monthNumber: index + 1,
      status: isActual ? 'actual' : isForecast ? 'forecast' : 'unavailable',
      booking,
      cashing,
      cost: monthlyCost,
      bookingActual: isActual ? booking : null,
      bookingForecast: isForecast ? booking : null,
      cashingActual: isActual ? cashing : null,
      cashingForecast: isForecast ? cashing : null,
    };
  });

  let cumulativeBooking = 0;
  let cumulativeCashing = 0;
  let cumulativeCost = 0;
  const cumulative = monthly.map((row) => {
    cumulativeBooking += row.booking;
    cumulativeCashing += row.cashing;
    cumulativeCost += row.cost;
    return { ...row, cumulativeBooking, cumulativeCashing, cumulativeCost };
  });

  const actualRows = monthly.filter((row) => row.status === 'actual');
  const forecastRows = monthly.filter((row) => row.status === 'forecast');
  const actualBooking = actualRows.reduce((sum, row) => sum + row.booking, 0);
  const actualCashing = actualRows.reduce((sum, row) => sum + row.cashing, 0);
  const forecastBooking = forecastRows.reduce((sum, row) => sum + row.booking, 0);
  const forecastCashing = forecastRows.reduce((sum, row) => sum + row.cashing, 0);
  const fullYearBooking = actualBooking + forecastBooking;
  const fullYearCashing = actualCashing + forecastCashing;
  const operatingResult = fullYearBooking - annualCost;
  const cashSurplus = fullYearCashing - annualCost;

  return {
    payload,
    currency: payload.metadata?.currency || actualData.currency,
    year,
    monthly,
    cumulative,
    actualBooking,
    actualCashing,
    forecastBooking,
    forecastCashing,
    fullYearBooking,
    fullYearCashing,
    annualCost,
    monthlyCost,
    operatingResult,
    operatingMargin: safeDivide(operatingResult, fullYearBooking),
    cashSurplus,
    cashCoverage: safeDivide(fullYearCashing, annualCost),
    bookingToCash: safeDivide(fullYearCashing, fullYearBooking),
  };
}

export function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
