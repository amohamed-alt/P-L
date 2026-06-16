'use strict';

    const CONFIG = Object.assign({
      title: 'Tech Licensing — Executive Performance Dashboard',
      subtitle: '2025 vs 2026',
      dataUrl: './data/dashboard-data.json',
      currency: '',
      refreshLabel: ''
    }, window.DASHBOARD_CONFIG || {});

    const METRICS = {
      booking: { label: 'Booking', color: '#1B3A2C' },
      cashing: { label: 'Cashing', color: '#2d7a4f' },
      cogs: { label: 'COGS', color: '#ef4444' },
      overheads: { label: 'Overheads', color: '#7c3aed' },
      support: { label: 'Support Allocation', color: '#ca8a04' }
    };

    const REQUIRED_METRICS = Object.keys(METRICS);
    const charts = {};
    let parsedData = null;
    let partialMonthIndex = -1;
    let latestDataMonthIndex = -1;
    let activeEndIndex = -1;

    const byId = (id) => document.getElementById(id);
    const sum = (arr) => arr.reduce((total, value) => total + (Number(value) || 0), 0);
    const median = (values) => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
      if (!sorted.length) return 0;
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const safeDivide = (numerator, denominator) => denominator ? numerator / denominator : null;

    function normalizeMetric(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/^support_allocation$/, 'support')
        .replace(/^overhead$/, 'overheads');
    }

    function parseNumber(value) {
      if (value === null || value === undefined || value === '') return 0;
      const cleaned = String(value).replace(/,/g, '').replace(/[()]/g, '').trim();
      if (!cleaned) return 0;
      const number = Number(cleaned);
      const isParenthesized = /^\(.*\)$/.test(String(value).trim());
      return Number.isFinite(number) ? (isParenthesized ? -number : number) : 0;
    }

    function formatFull(value, options = {}) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const absolute = Math.abs(value);
      const formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: options.decimals ?? 0,
        minimumFractionDigits: options.decimals ?? 0
      }).format(absolute);
      const prefix = options.currency && CONFIG.currency ? `${CONFIG.currency} ` : '';
      return value < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
    }

    function formatCompact(value, decimals = 2) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const absolute = Math.abs(value);
      let output;
      if (absolute >= 1_000_000) output = `${(absolute / 1_000_000).toFixed(decimals)}M`;
      else if (absolute >= 1_000) output = `${(absolute / 1_000).toFixed(absolute >= 100_000 ? 0 : 1)}K`;
      else output = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absolute);
      return value < 0 ? `(${output})` : output;
    }

    function formatPercent(value, decimals = 1) {
      return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(decimals)}%`;
    }

    function formatPoints(value, decimals = 1) {
      if (value === null || !Number.isFinite(value)) return '—';
      const points = value * 100;
      return `${points >= 0 ? '+' : ''}${points.toFixed(decimals)} pts`;
    }

    function signedCompact(value) {
      if (!Number.isFinite(value)) return '—';
      return value >= 0 ? `+${formatCompact(value)}` : `(${formatCompact(Math.abs(value))})`;
    }

    function normalizeDashboardJson(payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('The dashboard JSON is empty or invalid.');
      }

      if (!Array.isArray(payload.monthlyData) || !payload.monthlyData.length) {
        throw new Error('The dashboard JSON does not contain monthlyData records.');
      }

      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      const reportingYears = Array.isArray(payload.metadata?.reportingYears)
        ? payload.metadata.reportingYears.map(Number).filter(Number.isFinite)
        : [...new Set(payload.monthlyData.map((row) => Number(row.year)).filter(Number.isFinite))];

      const data = {
        months: monthNames,
        series: {},
        warnings: [],
        metadata: payload.metadata || {},
        dataQuality: payload.dataQuality || {},
        partialMonthIndexes: []
      };

      REQUIRED_METRICS.forEach((metric) => {
        data.series[metric] = {};
        reportingYears.forEach((year) => {
          data.series[metric][String(year)] = Array(12).fill(0);
        });
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

        REQUIRED_METRICS.forEach((metric) => {
          if (!data.series[metric][yearKey]) {
            data.series[metric][yearKey] = Array(12).fill(0);
          }
        });

        data.series.booking[yearKey][index] = Number(row.booking) || 0;
        data.series.cashing[yearKey][index] = Number(row.cashing) || 0;
        data.series.cogs[yearKey][index] = Number(row.cogs) || 0;
        data.series.overheads[yearKey][index] = Number(row.overheads) || 0;
        data.series.support[yearKey][index] = Number(row.supportAllocation ?? row.support) || 0;

        if (row.isPartial === true || row.status === 'partial') {
          data.partialMonthIndexes.push(index);
        }
      }

      if (Array.isArray(payload.dataQuality?.partialMonths)) {
        payload.dataQuality.partialMonths.forEach((row) => {
          const index = Number(row.monthNumber) - 1;
          if (index >= 0 && index < 12) data.partialMonthIndexes.push(index);
        });
      }

      data.partialMonthIndexes = [...new Set(data.partialMonthIndexes)].sort((a, b) => a - b);

      if (Array.isArray(payload.dataQuality?.missingMetrics) && payload.dataQuality.missingMetrics.length) {
        data.warnings.push(`${payload.dataQuality.missingMetrics.length} missing metric value(s) were reported by n8n.`);
      }

      if (Number(payload.dataQuality?.ignoredRows) > 0) {
        data.warnings.push(`${payload.dataQuality.ignoredRows} source row(s) were ignored during transformation.`);
      }

      if (payload.metadata?.currency && !CONFIG.currency) {
        CONFIG.currency = payload.metadata.currency;
      }

      return data;
    }

    function getMetricSeries(metric, year) {
      const values = parsedData?.series?.[metric]?.[String(year)] || [];
      return parsedData.months.map((_, index) => Number(values[index]) || 0);
    }

    function detectReportingPeriod() {
      const series2026 = Object.fromEntries(
        REQUIRED_METRICS.map((metric) => [metric, getMetricSeries(metric, 2026)])
      );

      const metadataLatestMonth = Number(parsedData.metadata?.latestDataMonthNumber);
      latestDataMonthIndex = Number.isInteger(metadataLatestMonth) && metadataLatestMonth >= 1
        ? metadataLatestMonth - 1
        : -1;

      if (latestDataMonthIndex < 0) {
        for (let i = 0; i < parsedData.months.length; i += 1) {
          if (REQUIRED_METRICS.some((metric) => series2026[metric][i] !== 0)) {
            latestDataMonthIndex = i;
          }
        }
      }

      partialMonthIndex = parsedData.partialMonthIndexes.length
        ? parsedData.partialMonthIndexes[parsedData.partialMonthIndexes.length - 1]
        : -1;

      const metadataClosedMonth = Number(parsedData.metadata?.closedMonthNumber);
      if (Number.isInteger(metadataClosedMonth) && metadataClosedMonth >= 1) {
        activeEndIndex = metadataClosedMonth - 1;
      } else {
        activeEndIndex = partialMonthIndex >= 0
          ? Math.max(0, partialMonthIndex - 1)
          : latestDataMonthIndex;
      }
    }

    function periodIndexes() {
      const endIndex = byId('includePartial').checked && partialMonthIndex >= 0 ? partialMonthIndex : activeEndIndex;
      return Array.from({ length: Math.max(0, endIndex + 1) }, (_, index) => index);
    }

    function periodLabel() {
      const indexes = periodIndexes();
      if (!indexes.length) return 'No reporting period';
      return `${parsedData.months[indexes[0]]}–${parsedData.months[indexes[indexes.length - 1]]}`;
    }

    function aggregate(year, metric, indexes = periodIndexes()) {
      const values = getMetricSeries(metric, year);
      return sum(indexes.map((index) => values[index] || 0));
    }

    function calculateSnapshot() {
      const indexes = periodIndexes();
      const snapshot = { indexes, years: {} };
      [2025, 2026].forEach((year) => {
        const booking = aggregate(year, 'booking', indexes);
        const cashing = aggregate(year, 'cashing', indexes);
        const cogs = aggregate(year, 'cogs', indexes);
        const overheads = aggregate(year, 'overheads', indexes);
        const support = aggregate(year, 'support', indexes);
        const totalCost = cogs + overheads + support;
        const operatingResult = booking - totalCost;
        const cashGap = cashing - totalCost;
        const cashCoverage = safeDivide(cashing, totalCost);
        const bookingToCash = safeDivide(cashing, booking);
        snapshot.years[year] = { booking, cashing, cogs, overheads, support, totalCost, operatingResult, cashGap, cashCoverage, bookingToCash };
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

      if (metric === 'operatingResult') {
        if (current >= 0) return { label: 'Strong', className: 'strong', positive: true };
        if (current > prior) return { label: 'Improving', className: 'improve', positive: true };
        return { label: 'Critical', className: 'critical', positive: false };
      }

      if (effectivePercent === null || Math.abs(effectivePercent) < 0.02) return { label: 'Stable', className: 'stable', positive: true };
      if (effectivePercent >= 0.15) return { label: 'Strong', className: 'strong', positive: true };
      if (effectivePercent > 0) return { label: 'Improving', className: 'improve', positive: true };
      if (effectivePercent <= -0.15) return { label: 'Critical', className: 'critical', positive: false };
      return { label: 'Watch', className: 'watch', positive: false };
    }

