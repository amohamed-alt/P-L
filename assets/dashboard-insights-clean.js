function renderInsights(snapshot) {
  const priorYear = snapshot.priorYear;
  const currentYear = snapshot.currentYear;
  const current = snapshot.years[currentYear];
  const prior = snapshot.years[priorYear];
  const records = monthlyRecords(snapshot.indexes, priorYear, currentYear);

  if (!current.hasData) {
    byId('insightList').innerHTML = `
      <div class="insight warn">
        <div class="insight-icon">⚠️</div>
        <div>
          <div class="insight-title">No ${currentYear} comparison data for ${periodLabel()}</div>
          <div class="insight-body">Choose an available month, use the Include MTD preset, or swap the years. Missing months are not treated as zero performance.</div>
        </div>
      </div>
      <div class="insight info">
        <div class="insight-icon">📅</div>
        <div>
          <div class="insight-title">Available ${currentYear} data ends in ${latestDataMonthIndex >= 0 ? parsedData.months[latestDataMonthIndex] : '—'}</div>
          <div class="insight-body">Use the quick presets above to return to the latest valid reporting period.</div>
        </div>
      </div>`;
    return;
  }

  const bookingVariance = prior.hasData ? getVariance(current.booking, prior.booking) : { absolute: null, percent: null };
  const cashingVariance = prior.hasData ? getVariance(current.cashing, prior.cashing) : { absolute: null, percent: null };
  const cogsVariance = prior.hasData ? getVariance(current.cogs, prior.cogs) : { absolute: null, percent: null };
  const overheadVariance = prior.hasData ? getVariance(current.overheads, prior.overheads) : { absolute: null, percent: null };
  const supportVariance = prior.hasData ? getVariance(current.support, prior.support) : { absolute: null, percent: null };
  const bookingCashGap = current.booking - current.cashing;
  const bestMonth = records.length ? [...records].sort((a, b) => b.bookingCurrent - a.bookingCurrent)[0] : null;
  const weakestMonth = records.length ? [...records].sort((a, b) => a.bookingCurrent - b.bookingCurrent)[0] : null;

  const insights = [
    {
      type: !prior.hasData ? 'info' : cashingVariance.percent !== null && bookingVariance.percent !== null && cashingVariance.percent > bookingVariance.percent ? 'pos' : 'info',
      icon: '📈',
      title: prior.hasData ? 'Commercial growth and collection performance' : 'Comparison-year performance',
      body: prior.hasData
        ? `Booking changed ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} from ${priorYear} to ${currentYear}, reaching ${formatCompact(current.booking, 2, { currency: true })}. Cashing changed ${cashingVariance.percent === null ? '—' : formatPercent(cashingVariance.percent)} to ${formatCompact(current.cashing, 2, { currency: true })}.`
        : `${currentYear} booking is ${formatCompact(current.booking, 2, { currency: true })} and cashing is ${formatCompact(current.cashing, 2, { currency: true })}. The ${priorYear} baseline is unavailable for this selected period.`
    },
    {
      type: prior.hasData && cogsVariance.percent !== null && cogsVariance.percent > 0.15 ? 'neg' : 'info',
      icon: '⚠️',
      title: 'COGS movement',
      body: prior.hasData
        ? `COGS changed ${cogsVariance.percent === null ? '—' : formatPercent(cogsVariance.percent)} to ${formatCompact(current.cogs, 2, { currency: true })}. Compare this with booking growth of ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} to separate volume growth from margin pressure.`
        : `${currentYear} COGS is ${formatCompact(current.cogs, 2, { currency: true })}. No ${priorYear} baseline is available for this period.`
    },
    {
      type: prior.hasData && overheadVariance.absolute <= 0 && supportVariance.absolute <= 0 ? 'pos' : 'warn',
      icon: '💡',
      title: 'Fixed-cost discipline',
      body: prior.hasData
        ? `Overheads changed ${overheadVariance.percent === null ? '—' : formatPercent(overheadVariance.percent)} and support allocation changed ${supportVariance.percent === null ? '—' : formatPercent(supportVariance.percent)} over the selected months.`
        : `Overheads are ${formatCompact(current.overheads, 2, { currency: true })} and support allocation is ${formatCompact(current.support, 2, { currency: true })} in ${currentYear}.`
    },
    {
      type: 'warn',
      icon: '📅',
      title: bestMonth ? `${bestMonth.month} is the strongest ${currentYear} booking month` : 'No monthly booking data is available',
      body: bestMonth
        ? `${bestMonth.month} delivered ${formatCompact(bestMonth.bookingCurrent, 2, { currency: true })}. ${weakestMonth.month} is the weakest available month at ${formatCompact(weakestMonth.bookingCurrent, 2, { currency: true })}.`
        : 'Change the filters to a period containing available monthly data.'
    },
    {
      type: bookingCashGap > 0 ? 'info' : 'pos',
      icon: '💰',
      title: bookingCashGap > 0 ? 'Booking is ahead of cashing' : 'Cashing meets or exceeds booking',
      body: `The selected-period difference between booking and cashing is ${formatFull(bookingCashGap)}. Cash coverage is ${formatPercent(current.cashCoverage)}, and booking-to-cash conversion is ${formatPercent(current.bookingToCash)}.`
    }
  ];

  byId('insightList').innerHTML = insights.map((insight) => `
    <div class="insight ${insight.type}">
      <div class="insight-icon">${insight.icon}</div>
      <div><div class="insight-title">${insight.title}</div><div class="insight-body">${insight.body}</div></div>
    </div>`).join('');
}

function renderDashboard() {
  detectReportingPeriod();
  const snapshot = calculateSnapshot();
  renderHeader();
  renderFilterSummary();
  renderDataQuality();
  renderKpis(snapshot);
  renderCharts(snapshot);
  renderCoverage(snapshot);
  renderMatrix(snapshot);
  renderInsights(snapshot);
}

function normalizeFilterState(changedId) {
  const priorSelect = byId('priorYear');
  const currentSelect = byId('currentYear');

  if (priorSelect.value === currentSelect.value) {
    const years = parsedData.reportingYears;
    if (changedId === 'priorYear') {
      currentSelect.value = String(years.find((year) => year !== Number(priorSelect.value)) ?? currentSelect.value);
    } else {
      priorSelect.value = String([...years].reverse().find((year) => year !== Number(currentSelect.value)) ?? priorSelect.value);
    }
  }

  const start = Number(byId('startMonth').value);
  const end = Number(byId('endMonth').value);
  if (start > end) {
    if (changedId === 'startMonth') byId('endMonth').value = String(start);
    else byId('startMonth').value = String(end);
  }

  if (byId('comparisonMode').value === 'closed') byId('includePartial').checked = false;
  if (byId('comparisonMode').value === 'available') byId('includePartial').checked = true;
}

function applyPreset(type) {
  detectReportingPeriod();
  byId('startMonth').value = '0';

  if (type === 'closed') {
    byId('comparisonMode').value = 'closed';
    byId('includePartial').checked = false;
    byId('endMonth').value = String(Math.max(0, closedMonthIndex));
    byId('fullYearContext').checked = true;
  }

  if (type === 'mtd') {
    byId('comparisonMode').value = 'available';
    byId('includePartial').checked = true;
    byId('endMonth').value = String(Math.max(0, latestDataMonthIndex));
    byId('fullYearContext').checked = true;
  }

  if (type === 'currentMonth') {
    const monthIndex = Math.max(0, latestDataMonthIndex);
    byId('comparisonMode').value = 'custom';
    byId('includePartial').checked = true;
    byId('startMonth').value = String(monthIndex);
    byId('endMonth').value = String(monthIndex);
    byId('fullYearContext').checked = false;
  }

  renderDashboard();
}

function swapYears() {
  const priorValue = byId('priorYear').value;
  byId('priorYear').value = byId('currentYear').value;
  byId('currentYear').value = priorValue;
  detectReportingPeriod();

  if (byId('comparisonMode').value === 'available') {
    byId('endMonth').value = String(Math.max(0, latestDataMonthIndex));
  }
  if (byId('comparisonMode').value === 'closed') {
    byId('endMonth').value = String(Math.max(0, closedMonthIndex));
  }

  renderDashboard();
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportSelectedCsv() {
  const { prior, current } = selectedYears();
  const indexes = periodIndexes();
  const metrics = ['booking', 'cashing', 'cogs', 'overheads', 'support', 'totalCost', 'cashGap', 'cashCoverage', 'bookingToCash'];
  const headers = ['Month', 'Year', 'Status', ...metrics.map((metric) => METRICS[metric].label)];
  const rows = [headers];

  [prior, current].forEach((year) => {
    indexes.forEach((index) => {
      const available = monthHasData(year, index);
      const status = !available ? 'unavailable' : monthIsPartial(year, index) ? 'partial' : 'available';
      rows.push([
        parsedData.months[index],
        year,
        status,
        ...metrics.map((metric) => available ? getMetricSeries(metric, year)[index] : '')
      ]);
    });
  });

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tech-licensing-${prior}-vs-${current}-${periodLabel().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function attachFilterEvents() {
  const filterIds = [
    'priorYear',
    'currentYear',
    'comparisonMode',
    'startMonth',
    'endMonth',
    'metricFocus',
    'includePartial',
    'fullYearContext'
  ];

  filterIds.forEach((id) => {
    byId(id).addEventListener('change', () => {
      normalizeFilterState(id);
      renderDashboard();
    });
  });

  byId('presetClosed').addEventListener('click', () => applyPreset('closed'));
  byId('presetMtd').addEventListener('click', () => applyPreset('mtd'));
  byId('presetCurrentMonth').addEventListener('click', () => applyPreset('currentMonth'));
  byId('swapYears').addEventListener('click', swapYears);
  byId('resetFilters').addEventListener('click', () => {
    populateFilters();
    renderDashboard();
  });
  byId('refreshButton').addEventListener('click', loadDashboard);
  byId('exportCsvButton').addEventListener('click', exportSelectedCsv);
  byId('printButton').addEventListener('click', () => window.print());
}

async function loadDashboard() {
  byId('loadingOverlay').classList.remove('hidden');
  byId('statusBanner').className = 'status-banner';

  try {
    const separator = CONFIG.dataUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${CONFIG.dataUrl}${separator}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load dashboard JSON (${response.status} ${response.statusText}).`);

    const payload = await response.json();
    parsedData = normalizeDashboardJson(payload);
    populateFilters();
    renderDashboard();
  } catch (error) {
    console.error(error);
    const banner = byId('statusBanner');
    banner.className = 'status-banner error show';
    banner.textContent = `${error.message} Confirm that data/dashboard-data.json exists on the main branch and that GitHub Pages is publishing the repository.`;
    byId('kpiGrid').innerHTML = '<div class="card empty-state" style="grid-column:1/-1">Dashboard data could not be loaded.</div>';
  } finally {
    byId('loadingOverlay').classList.add('hidden');
  }
}

attachFilterEvents();
loadDashboard();
