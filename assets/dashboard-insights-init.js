function renderInsightsAndRecommendations(snapshot) {
  const priorYear = snapshot.priorYear;
  const currentYear = snapshot.currentYear;
  const current = snapshot.years[currentYear];
  const prior = snapshot.years[priorYear];
  const records = monthlyRecords(snapshot.indexes, priorYear, currentYear);

  const bookingVariance = getVariance(current.booking, prior.booking);
  const cashingVariance = getVariance(current.cashing, prior.cashing);
  const cogsVariance = getVariance(current.cogs, prior.cogs);
  const overheadVariance = getVariance(current.overheads, prior.overheads);
  const supportVariance = getVariance(current.support, prior.support);
  const operatingImprovement = current.operatingResult - prior.operatingResult;
  const receivablesGap = current.booking - current.cashing;
  const bestMonth = records.length ? [...records].sort((a, b) => b.bookingCurrent - a.bookingCurrent)[0] : null;
  const weakestMonth = records.length ? [...records].sort((a, b) => a.bookingCurrent - b.bookingCurrent)[0] : null;
  const averageMonthlyCost = snapshot.indexes.length ? current.totalCost / snapshot.indexes.length : 0;
  const monthlyBreakEvenGap = snapshot.indexes.length ? Math.max(0, -current.operatingResult / snapshot.indexes.length) : 0;

  const insights = [
    {
      type: cashingVariance.percent !== null && bookingVariance.percent !== null && cashingVariance.percent > bookingVariance.percent ? 'pos' : 'info',
      icon: '📈',
      title: 'Commercial growth and collection performance',
      body: `Booking changed ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} from ${priorYear} to ${currentYear}, reaching ${formatCompact(current.booking, 2, { currency: true })}. Cashing changed ${cashingVariance.percent === null ? '—' : formatPercent(cashingVariance.percent)} to ${formatCompact(current.cashing, 2, { currency: true })}.`
    },
    {
      type: current.operatingResult >= 0 ? 'pos' : operatingImprovement > 0 ? 'pos' : 'neg',
      icon: current.operatingResult >= 0 ? '✅' : '⚖️',
      title: current.operatingResult >= 0 ? 'The selected period is above operating break-even' : 'Operating result remains below break-even',
      body: `The ${currentYear} operating result is ${formatFull(current.operatingResult)}. This is ${operatingImprovement >= 0 ? 'an improvement of' : 'a decline of'} ${formatCompact(Math.abs(operatingImprovement), 2, { currency: true })} compared with ${priorYear}.`
    },
    {
      type: cogsVariance.percent !== null && cogsVariance.percent > 0.15 ? 'neg' : 'info',
      icon: '⚠️',
      title: 'COGS movement requires review',
      body: `COGS changed ${cogsVariance.percent === null ? '—' : formatPercent(cogsVariance.percent)} to ${formatCompact(current.cogs, 2, { currency: true })}. Compare this with booking growth of ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} to separate volume growth from margin pressure.`
    },
    {
      type: overheadVariance.absolute <= 0 && supportVariance.absolute <= 0 ? 'pos' : 'warn',
      icon: '💡',
      title: 'Fixed-cost discipline',
      body: `Overheads changed ${overheadVariance.percent === null ? '—' : formatPercent(overheadVariance.percent)} and support allocation changed ${supportVariance.percent === null ? '—' : formatPercent(supportVariance.percent)} over the selected months.`
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
      type: receivablesGap > 0 ? 'info' : 'pos',
      icon: '💰',
      title: receivablesGap > 0 ? 'Booking-to-cash gap remains outstanding' : 'Cashing exceeds booking',
      body: `The selected-period booking-to-cash gap is ${formatFull(receivablesGap)}. Cash coverage is ${formatPercent(current.cashCoverage)}, and booking-to-cash conversion is ${formatPercent(current.bookingToCash)}.`
    }
  ];

  byId('insightList').innerHTML = insights.map((insight) => `
    <div class="insight ${insight.type}">
      <div class="insight-icon">${insight.icon}</div>
      <div><div class="insight-title">${insight.title}</div><div class="insight-body">${insight.body}</div></div>
    </div>`).join('');

  const recommendations = [
    {
      title: 'Investigate COGS and protect gross margin',
      priority: 'High Priority',
      priorityClass: 'p1',
      body: `COGS changed ${cogsVariance.percent === null ? '—' : formatPercent(cogsVariance.percent)}. Reconcile vendor, delivery, implementation, and allocation drivers before the next forecast cycle.`
    },
    {
      title: 'Set a formal monthly break-even booking floor',
      priority: 'High Priority',
      priorityClass: 'p1',
      body: `Average monthly cost in the selected period is about ${formatCompact(averageMonthlyCost, 2, { currency: true })}. Add the current average monthly shortfall of ${formatCompact(monthlyBreakEvenGap, 2, { currency: true })} and set the operating floor above that level.`
    },
    {
      title: 'Accelerate collection of the booking-to-cash gap',
      priority: 'Medium',
      priorityClass: 'p2',
      body: `The outstanding gap is ${formatCompact(receivablesGap, 2, { currency: true })}. Review overdue invoices weekly and manage conversion above the current ${formatPercent(current.bookingToCash)}.`
    },
    {
      title: bestMonth ? `Replicate the ${bestMonth.month} pipeline conditions` : 'Review the strongest available month',
      priority: 'Medium',
      priorityClass: 'p2',
      body: bestMonth
        ? `Review source, product mix, owner contribution, pricing, and close timing behind ${bestMonth.month} to turn the strongest month into a repeatable playbook.`
        : 'Select an available period to identify and analyze the strongest booking month.'
    },
    {
      title: 'Complete current-month cost allocation before final reporting',
      priority: 'Operational',
      priorityClass: 'p3',
      body: (parsedData.partial[String(currentYear)] || []).some(Boolean)
        ? `The current ${currentYear} month is visible as MTD, but incomplete cost allocation can distort profitability and coverage. Keep the MTD badge until the month is closed.`
        : 'Maintain a documented monthly close date so every management comparison uses complete and equivalent data.'
    }
  ];

  byId('recommendationList').innerHTML = recommendations.map((recommendation, index) => `
    <div class="rec">
      <div class="rec-header">
        <div class="rec-num">${index + 1}</div>
        <div class="rec-title">${recommendation.title}</div>
        <div class="priority-tag ${recommendation.priorityClass}">${recommendation.priority}</div>
      </div>
      <div class="rec-body">${recommendation.body}</div>
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
  renderInsightsAndRecommendations(snapshot);
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

  byId('resetFilters').addEventListener('click', () => {
    populateFilters();
    renderDashboard();
  });
  byId('refreshButton').addEventListener('click', loadDashboard);
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
