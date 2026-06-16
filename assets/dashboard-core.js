'use strict';

const CONFIG = Object.assign({
  title: 'Tech Licensing — Executive Performance Dashboard',
  subtitle: 'Flexible reporting comparison',
  dataUrl: './data/dashboard-data.json',
  currencySymbol: '$',
  refreshLabel: ''
}, window.DASHBOARD_CONFIG || {});

const METRICS = {
  booking: { label: 'Booking', color: '#173f2e', kind: 'amount' },
  cashing: { label: 'Cashing', color: '#2d6a4f', kind: 'amount' },
  cogs: { label: 'COGS', color: '#ef4444', kind: 'amount' },
  overheads: { label: 'Overheads', color: '#7c3aed', kind: 'amount' },
  support: { label: 'Support Allocation', color: '#ca8a04', kind: 'amount' },
  totalCost: { label: 'Total Cost', color: '#7c3aed', kind: 'amount' },
  cashGap: { label: 'Cash Gap', color: '#ea580c', kind: 'amount' },
  cashCoverage: { label: 'Cash Coverage', color: '#ea580c', kind: 'ratio' },
  bookingToCash: { label: 'Booking-to-Cash', color: '#2563eb', kind: 'ratio' }
};

const SOURCE_METRICS = ['booking', 'cashing', 'cogs', 'overheads', 'support'];
const charts = {};
let parsedData = null;
let latestDataMonthIndex = -1;
let closedMonthIndex = -1;

const byId = (id) => document.getElementById(id);
const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);
const safeDivide = (numerator, denominator) => denominator ? numerator / denominator : null;

function formatFull(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: options.decimals ?? 0,
    minimumFractionDigits: options.decimals ?? 0
  }).format(absolute);
  const prefix = options.currency === false ? '' : CONFIG.currencySymbol;
  return value < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
}

function formatCompact(value, decimals = 2, options = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const absolute = Math.abs(value);
  let output;
  if (absolute >= 1_000_000) output = `${(absolute / 1_000_000).toFixed(decimals)}M`;
  else if (absolute >= 1_000) output = `${(absolute / 1_000).toFixed(absolute >= 100_000 ? 0 : 1)}K`;
  else output = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absolute);
  const prefix = options.currency ? CONFIG.currencySymbol : '';
  return value < 0 ? `(${prefix}${output})` : `${prefix}${output}`;
}

function formatAxis(value) {
  return formatCompact(value, 1, { currency: true });
}

function formatPercent(value, decimals = 1) {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(decimals)}%`;
}

function formatPoints(value, decimals = 1) {
  if (value === null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${points >= 0 ? '+' : ''}${points.toFixed(decimals)} pts`;
}

function signedCompact(value, options = {}) {
  if (!Number.isFinite(value)) return '—';
  const compact = formatCompact(Math.abs(value), 2, { currency: options.currency !== false });
  return value >= 0 ? `+${compact}` : `(${compact})`;
}

function normalizeDashboardJson(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('The dashboard JSON is empty or invalid.');
  if (!Array.isArray(payload.monthlyData) || !payload.monthlyData.length) {
    throw new Error('The dashboard JSON does not contain monthlyData records.');
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reportingYears = Array.isArray(payload.metadata?.reportingYears)
    ? payload.metadata.reportingYears.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : [...new Set(payload.monthlyData.map((row) => Number(row.year)).filter(Number.isFinite))].sort((a, b) => a - b);

  const data = {
    months,
    reportingYears,
    series: {},
    availability: {},
    partial: {},
    warnings: [],
    metadata: payload.metadata || {},
    dataQuality: payload.dataQuality || {}
  };

  SOURCE_METRICS.forEach((metric) => {
    data.series[metric] = {};
    reportingYears.forEach((year) => {
      data.series[metric][String(year)] = Array(12).fill(0);
    });
  });

  reportingYears.forEach((year) => {
    data.availability[String(year)] = Array(12).fill(false);
    data.partial[String(year)] = Array(12).fill(false);
  });

  for (const row of payload.monthlyData) {
    const year = Number(row.year);
    const monthNumber = Number(row.monthNumber);
    if (!Number.isFinite(year) || monthNumber < 1 || monthNumber > 12) {
      data.warnings.push('A monthly record was skipped because its year or month number was invalid.');
      continue;
    }

    const yearKey = String(year);
    const index = monthNumber - 1;
    if (!data.availability[yearKey]) {
      data.availability[yearKey] = Array(12).fill(false);
      data.partial[yearKey] = Array(12).fill(false);
      SOURCE_METRICS.forEach((metric) => {
        data.series[metric][yearKey] = Array(12).fill(0);
      });
      data.reportingYears.push(year);
    }

    data.series.booking[yearKey][index] = Number(row.booking) || 0;
    data.series.cashing[yearKey][index] = Number(row.cashing) || 0;
    data.series.cogs[yearKey][index] = Number(row.cogs) || 0;
    data.series.overheads[yearKey][index] = Number(row.overheads) || 0;
    data.series.support[yearKey][index] = Number(row.supportAllocation ?? row.support) || 0;

    const hasData = row.hasMeaningfulData === true || SOURCE_METRICS.some((metric) => data.series[metric][yearKey][index] !== 0);
    data.availability[yearKey][index] = hasData;
    data.partial[yearKey][index] = row.isPartial === true || row.status === 'partial';
  }

  if (Array.isArray(payload.dataQuality?.missingMetrics) && payload.dataQuality.missingMetrics.length) {
    data.warnings.push(`${payload.dataQuality.missingMetrics.length} missing metric value(s) were reported by n8n.`);
  }
  if (Number(payload.dataQuality?.ignoredRows) > 0) {
    data.warnings.push(`${payload.dataQuality.ignoredRows} source row(s) were ignored during transformation.`);
  }

  data.reportingYears = [...new Set(data.reportingYears)].sort((a, b) => a - b);
  return data;
}

function getMetricSeries(metric, year) {
  if (SOURCE_METRICS.includes(metric)) {
    const values = parsedData?.series?.[metric]?.[String(year)] || [];
    return parsedData.months.map((_, index) => Number(values[index]) || 0);
  }

  const booking = getMetricSeries('booking', year);
  const cashing = getMetricSeries('cashing', year);
  const cogs = getMetricSeries('cogs', year);
  const overheads = getMetricSeries('overheads', year);
  const support = getMetricSeries('support', year);

  return parsedData.months.map((_, index) => {
    const totalCost = cogs[index] + overheads[index] + support[index];
    if (metric === 'totalCost') return totalCost;
    if (metric === 'cashGap') return cashing[index] - totalCost;
    if (metric === 'cashCoverage') return safeDivide(cashing[index], totalCost);
    if (metric === 'bookingToCash') return safeDivide(cashing[index], booking[index]);
    return 0;
  });
}

function monthHasData(year, index) {
  return Boolean(parsedData?.availability?.[String(year)]?.[index]);
}

function monthIsPartial(year, index) {
  return Boolean(parsedData?.partial?.[String(year)]?.[index]);
}

function selectedYears() {
  return {
    prior: Number(byId('priorYear').value),
    current: Number(byId('currentYear').value)
  };
}

function selectedMonthBounds() {
  let start = Number(byId('startMonth').value);
  let end = Number(byId('endMonth').value);
  if (!Number.isInteger(start)) start = 0;
  if (!Number.isInteger(end)) end = 11;
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

function detectReportingPeriod() {
  const { current } = selectedYears();
  const metadataLatestMonth = Number(parsedData.metadata?.latestDataMonthNumber);
  latestDataMonthIndex = Number.isInteger(metadataLatestMonth) && metadataLatestMonth >= 1
    ? metadataLatestMonth - 1
    : -1;

  if (latestDataMonthIndex < 0 || current !== Number(parsedData.metadata?.currentReportingYear)) {
    latestDataMonthIndex = -1;
    for (let index = 0; index < 12; index += 1) {
      if (monthHasData(current, index)) latestDataMonthIndex = index;
    }
  }

  const metadataClosedMonth = Number(parsedData.metadata?.closedMonthNumber);
  const metadataCurrentYear = Number(parsedData.metadata?.currentReportingYear);
  closedMonthIndex = current === metadataCurrentYear && Number.isInteger(metadataClosedMonth) && metadataClosedMonth >= 1
    ? metadataClosedMonth - 1
    : latestDataMonthIndex;

  const firstPartial = parsedData.partial[String(current)]?.findIndex(Boolean) ?? -1;
  if (firstPartial >= 0) closedMonthIndex = Math.min(closedMonthIndex, firstPartial - 1);
}

function periodIndexes() {
  const { start, end } = selectedMonthBounds();
  const mode = byId('comparisonMode').value;
  const includePartial = byId('includePartial').checked;
  const { current } = selectedYears();

  let effectiveEnd = end;
  if (mode === 'available') effectiveEnd = Math.min(end, latestDataMonthIndex);
  if (mode === 'closed') effectiveEnd = Math.min(end, closedMonthIndex);

  const indexes = [];
  for (let index = start; index <= effectiveEnd; index += 1) {
    if (!includePartial && monthIsPartial(current, index)) continue;
    indexes.push(index);
  }
  return indexes;
}

function displayIndexes() {
  if (byId('fullYearContext').checked) return Array.from({ length: 12 }, (_, index) => index);
  const { start, end } = selectedMonthBounds();
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
}

function periodLabel() {
  const indexes = periodIndexes();
  if (!indexes.length) return 'No reporting period';
  return `${parsedData.months[indexes[0]]}–${parsedData.months[indexes[indexes.length - 1]]}`;
}

function aggregate(year, metric, indexes = periodIndexes()) {
  const values = getMetricSeries(metric, year);
  return sum(indexes.map((index) => values[index] ?? 0));
}

function calculateSnapshot() {
  const indexes = periodIndexes();
  const { prior, current } = selectedYears();
  const snapshot = { indexes, priorYear: prior, currentYear: current, years: {} };

  [prior, current].forEach((year) => {
    const availableIndexes = indexes.filter((index) => monthHasData(year, index));
    const booking = aggregate(year, 'booking', availableIndexes);
    const cashing = aggregate(year, 'cashing', availableIndexes);
    const cogs = aggregate(year, 'cogs', availableIndexes);
    const overheads = aggregate(year, 'overheads', availableIndexes);
    const support = aggregate(year, 'support', availableIndexes);
    const totalCost = cogs + overheads + support;
    const cashGap = cashing - totalCost;
    const cashCoverage = safeDivide(cashing, totalCost);
    const bookingToCash = safeDivide(cashing, booking);

    snapshot.years[year] = {
      booking,
      cashing,
      cogs,
      overheads,
      support,
      totalCost,
      cashGap,
      cashCoverage,
      bookingToCash,
      availableMonthCount: availableIndexes.length,
      requestedMonthCount: indexes.length,
      hasData: availableIndexes.length > 0,
      completeForPeriod: indexes.length > 0 && availableIndexes.length === indexes.length
    };
  });

  return snapshot;
}

function getVariance(current, prior) {
  return {
    absolute: current - prior,
    percent: prior ? (current - prior) / Math.abs(prior) : null
  };
}

function statusFor(metric, current, prior) {
  const variance = getVariance(current, prior);
  const lowerIsBetter = ['totalCost', 'cogs', 'overheads', 'support'].includes(metric);
  const effectivePercent = lowerIsBetter && variance.percent !== null ? -variance.percent : variance.percent;

  if (effectivePercent === null || Math.abs(effectivePercent) < 0.02) return { label: 'Stable', className: 'stable', positive: true };
  if (effectivePercent >= 0.15) return { label: 'Strong', className: 'strong', positive: true };
  if (effectivePercent > 0) return { label: 'Improving', className: 'improve', positive: true };
  if (effectivePercent <= -0.15) return { label: 'Critical', className: 'critical', positive: false };
  return { label: 'Watch', className: 'watch', positive: false };
}

function valueForDisplay(metric, year, index) {
  if (!monthHasData(year, index)) return null;
  return getMetricSeries(metric, year)[index];
}
