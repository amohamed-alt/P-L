'use strict';

const FORECAST_DATA_URL = './data/forecast-data.json';
const FORECAST_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const forecastState = {
  data: null,
  charts: {},
  activeTab: 'actual'
};

const forecastById = (id) => document.getElementById(id);
const forecastSum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);
const forecastDivide = (numerator, denominator) => denominator ? numerator / denominator : null;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForActualDashboard(timeoutMs = 12000) {
  const startedAt = Date.now();
  while (!parsedData && Date.now() - startedAt < timeoutMs) {
    await wait(100);
  }
  if (!parsedData) throw new Error('The live actual dashboard data did not finish loading.');
}

function validateForecastPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Forecast data is empty or invalid.');
  if (!Array.isArray(payload.booking) || !Array.isArray(payload.cashing)) {
    throw new Error('Forecast data must contain booking and cashing owner rows.');
  }

  const forecastMonthCount = Number(payload.metadata?.forecastEndMonthNumber) - Number(payload.metadata?.forecastStartMonthNumber) + 1;
  if (!Number.isInteger(forecastMonthCount) || forecastMonthCount <= 0) {
    throw new Error('Forecast start and end months are invalid.');
  }

  [...payload.booking, ...payload.cashing].forEach((row) => {
    if (!row.owner || !Array.isArray(row.monthly) || row.monthly.length !== forecastMonthCount) {
      throw new Error(`Forecast row ${row.owner || 'without owner'} has an invalid monthly structure.`);
    }
  });

  const annualCost = Number(payload.costPlan?.annualCost);
  if (!Number.isFinite(annualCost) || annualCost <= 0) throw new Error('Annual forecast cost must be a positive number.');
  return payload;
}

function forecastMonthlyTotals(rows) {
  if (!rows.length) return [];
  return rows[0].monthly.map((_, index) => forecastSum(rows.map((row) => row.monthly[index])));
}

function calculateForecastSnapshot() {
  const data = forecastState.data;
  const year = Number(data.metadata.year);
  const actualThroughIndex = Number(data.metadata.actualThroughMonthNumber) - 1;
  const forecastStartIndex = Number(data.metadata.forecastStartMonthNumber) - 1;
  const forecastEndIndex = Number(data.metadata.forecastEndMonthNumber) - 1;
  const bookingForecast = forecastMonthlyTotals(data.booking);
  const cashingForecast = forecastMonthlyTotals(data.cashing);
  const actualBookingSeries = getMetricSeries('booking', year);
  const actualCashingSeries = getMetricSeries('cashing', year);
  const annualCost = Number(data.costPlan.annualCost);
  const monthlyCost = annualCost / 12;

  const monthly = FORECAST_MONTHS.map((month, index) => {
    const isActual = index <= actualThroughIndex;
    const isForecast = index >= forecastStartIndex && index <= forecastEndIndex;
    const forecastOffset = index - forecastStartIndex;
    const booking = isActual
      ? Number(actualBookingSeries[index]) || 0
      : isForecast ? Number(bookingForecast[forecastOffset]) || 0 : 0;
    const cashing = isActual
      ? Number(actualCashingSeries[index]) || 0
      : isForecast ? Number(cashingForecast[forecastOffset]) || 0 : 0;

    return {
      month,
      monthNumber: index + 1,
      status: isActual ? 'actual' : isForecast ? 'forecast' : 'unavailable',
      booking,
      cashing,
      cost: monthlyCost,
      operatingResult: booking - monthlyCost,
      cashPosition: cashing - monthlyCost
    };
  });

  const actualRows = monthly.filter((row) => row.status === 'actual');
  const forecastRows = monthly.filter((row) => row.status === 'forecast');
  const actualBooking = forecastSum(actualRows.map((row) => row.booking));
  const actualCashing = forecastSum(actualRows.map((row) => row.cashing));
  const forecastBooking = forecastSum(forecastRows.map((row) => row.booking));
  const forecastCashing = forecastSum(forecastRows.map((row) => row.cashing));
  const fullYearBooking = actualBooking + forecastBooking;
  const fullYearCashing = actualCashing + forecastCashing;
  const operatingResult = fullYearBooking - annualCost;
  const cashSurplus = fullYearCashing - annualCost;

  return {
    year,
    actualThroughIndex,
    forecastStartIndex,
    forecastEndIndex,
    monthly,
    actualBooking,
    actualCashing,
    forecastBooking,
    forecastCashing,
    fullYearBooking,
    fullYearCashing,
    annualCost,
    monthlyCost,
    operatingResult,
    operatingMargin: forecastDivide(operatingResult, fullYearBooking),
    cashSurplus,
    cashCoverage: forecastDivide(fullYearCashing, annualCost),
    bookingToCash: forecastDivide(fullYearCashing, fullYearBooking),
    forecastBookingShare: forecastDivide(forecastBooking, fullYearBooking),
    forecastCashingShare: forecastDivide(forecastCashing, fullYearCashing)
  };
}

function forecastFormatMoney(value) {
  return formatFull(value);
}

function forecastFormatCompact(value) {
  return formatCompact(value, 2, { currency: true });
}

function renderForecastStatus(snapshot) {
  const banner = forecastById('forecastStatusBanner');
  const expected = forecastState.data.expectedTotals || {};
  const warnings = [];

  if (Number(expected.forecastBooking) !== Math.round(snapshot.forecastBooking)) {
    warnings.push('Booking forecast rows do not match the expected total.');
  }
  if (Number(expected.forecastCashing) !== Math.round(snapshot.forecastCashing)) {
    warnings.push('Cashing forecast rows do not match the expected total.');
  }
  if (Number(expected.annualCost) !== Math.round(snapshot.annualCost)) {
    warnings.push('Annual cost does not match the approved forecast cost.');
  }

  const sourceNote = `${snapshot.year} outlook uses live actuals through ${forecastState.data.metadata.actualThroughMonth} and the supplied forecast from ${forecastState.data.metadata.forecastStartMonth} to ${forecastState.data.metadata.forecastEndMonth}.`;
  const exclusionNote = forecastState.data.metadata.note || '';

  banner.className = warnings.length ? 'status-banner warn show' : 'status-banner info show';
  banner.innerHTML = `
    <div class="forecast-status-note">
      <span>${warnings.length ? '⚠️' : 'ℹ️'}</span>
      <div><strong>${warnings.length ? warnings.join(' ') : 'Forecast data reconciled successfully.'}</strong>${sourceNote} ${exclusionNote}</div>
    </div>`;
}

function renderForecastKpis(snapshot) {
  const cards = [
    {
      label: 'Full-Year Booking',
      value: snapshot.fullYearBooking,
      accent: '#173f2e',
      badge: 'Actual + Forecast',
      badgeClass: 'strong',
      note: `${forecastFormatCompact(snapshot.actualBooking)} actual + ${forecastFormatCompact(snapshot.forecastBooking)} forecast`,
      footer: `${formatPercent(snapshot.forecastBookingShare)} of the year is forecast booking`
    },
    {
      label: 'Full-Year Cashing',
      value: snapshot.fullYearCashing,
      accent: '#2d6a4f',
      badge: 'Actual + Forecast',
      badgeClass: 'strong',
      note: `${forecastFormatCompact(snapshot.actualCashing)} actual + ${forecastFormatCompact(snapshot.forecastCashing)} forecast`,
      footer: `${formatPercent(snapshot.bookingToCash)} booking-to-cash`
    },
    {
      label: 'Annual Cost Plan',
      value: snapshot.annualCost,
      accent: '#7c3aed',
      badge: 'Fixed Plan',
      badgeClass: 'stable',
      note: `${forecastFormatMoney(forecastState.data.costPlan.displayMonthlyCost)} average monthly cost`,
      footer: 'Used only inside the Forecasting tab'
    },
    {
      label: 'Operating Result',
      value: snapshot.operatingResult,
      accent: '#16a34a',
      badge: snapshot.operatingResult >= 0 ? 'Positive' : 'Negative',
      badgeClass: snapshot.operatingResult >= 0 ? 'strong' : 'critical',
      note: 'Full-year booking less annual cost',
      footer: `${formatPercent(snapshot.operatingMargin)} operating margin`
    },
    {
      label: 'Cash Surplus',
      value: snapshot.cashSurplus,
      accent: '#2563eb',
      badge: snapshot.cashSurplus >= 0 ? 'Covered' : 'Gap',
      badgeClass: snapshot.cashSurplus >= 0 ? 'improve' : 'critical',
      note: 'Full-year cashing less annual cost',
      footer: `${formatPercent(snapshot.cashCoverage)} cash coverage`
    },
    {
      label: 'Monthly Cost',
      value: forecastState.data.costPlan.displayMonthlyCost,
      accent: '#ca8a04',
      badge: 'Average',
      badgeClass: 'stable',
      note: `Calculated monthly average: ${forecastFormatMoney(snapshot.monthlyCost)}`,
      footer: `Annual total reconciles to ${forecastFormatCompact(snapshot.annualCost)}`
    }
  ];

  forecastById('forecastKpiGrid').innerHTML = cards.map((card) => `
    <article class="kpi" style="--kpi-accent:${card.accent}">
      <span class="badge ${card.badgeClass}">${card.badge}</span>
      <div class="kpi-label">${card.label}</div>
      <div class="kpi-val">${forecastFormatCompact(card.value)}</div>
      <div class="kpi-prior">${card.note}</div>
      <div class="kpi-var neutral">${card.footer}</div>
    </article>`).join('');
}

function destroyForecastChart(name) {
  if (forecastState.charts[name]) forecastState.charts[name].destroy();
}

function forecastChartBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 420, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { font: { size: 10 }, color: '#64748b', boxWidth: 11, usePointStyle: true }
      },
      tooltip: {
        callbacks: {
          afterLabel(context) {
            const row = context.chart.$forecastRows?.[context.dataIndex];
            return row ? ` ${row.status === 'actual' ? 'Actual' : 'Forecast'}` : '';
          },
          label(context) {
            return ` ${context.dataset.label}: ${forecastFormatMoney(context.raw)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' },
        grid: { color: '#f1f5f9' },
        border: { display: false }
      },
      x: {
        ticks: { font: { size: 10 }, color: '#64748b' },
        grid: { display: false },
        border: { display: false }
      }
    }
  };
}

function renderForecastCharts(snapshot) {
  const actualBookingColor = '#173f2e';
  const forecastBookingColor = '#86b89f';
  const actualCashingColor = '#2d6a4f';
  const forecastCashingColor = '#8fd3b0';
  const bookingColors = snapshot.monthly.map((row) => row.status === 'actual' ? actualBookingColor : forecastBookingColor);
  const cashingColors = snapshot.monthly.map((row) => row.status === 'actual' ? actualCashingColor : forecastCashingColor);

  destroyForecastChart('monthly');
  const monthlyChart = new Chart(forecastById('forecastMonthlyChart'), {
    type: 'bar',
    data: {
      labels: snapshot.monthly.map((row) => row.month),
      datasets: [
        {
          label: 'Booking',
          data: snapshot.monthly.map((row) => row.booking),
          backgroundColor: bookingColors,
          borderRadius: 5
        },
        {
          label: 'Cashing',
          data: snapshot.monthly.map((row) => row.cashing),
          backgroundColor: cashingColors,
          borderRadius: 5
        },
        {
          type: 'line',
          label: 'Monthly Cost',
          data: snapshot.monthly.map((row) => row.cost),
          borderColor: '#7c3aed',
          backgroundColor: '#7c3aed',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 2,
          tension: .2
        }
      ]
    },
    options: forecastChartBaseOptions()
  });
  monthlyChart.$forecastRows = snapshot.monthly;
  forecastState.charts.monthly = monthlyChart;

  let cumulativeBooking = 0;
  let cumulativeCashing = 0;
  let cumulativeCost = 0;
  const cumulativeRows = snapshot.monthly.map((row) => {
    cumulativeBooking += row.booking;
    cumulativeCashing += row.cashing;
    cumulativeCost += row.cost;
    return {
      ...row,
      cumulativeBooking,
      cumulativeCashing,
      cumulativeCost
    };
  });

  destroyForecastChart('cumulative');
  const cumulativeChart = new Chart(forecastById('forecastCumulativeChart'), {
    type: 'line',
    data: {
      labels: cumulativeRows.map((row) => row.month),
      datasets: [
        { label: 'Cumulative Booking', data: cumulativeRows.map((row) => row.cumulativeBooking), borderColor: '#173f2e', backgroundColor: '#173f2e', borderWidth: 2.5, pointRadius: 3, tension: .25 },
        { label: 'Cumulative Cashing', data: cumulativeRows.map((row) => row.cumulativeCashing), borderColor: '#2d6a4f', backgroundColor: '#2d6a4f', borderWidth: 2.5, pointRadius: 3, tension: .25 },
        { label: 'Cumulative Cost', data: cumulativeRows.map((row) => row.cumulativeCost), borderColor: '#7c3aed', backgroundColor: '#7c3aed', borderDash: [6, 4], borderWidth: 2, pointRadius: 2, tension: .2 }
      ]
    },
    options: forecastChartBaseOptions()
  });
  cumulativeChart.$forecastRows = snapshot.monthly;
  forecastState.charts.cumulative = cumulativeChart;
}

function renderForecastPosition(snapshot) {
  forecastById('forecastPositionGrid').innerHTML = `
    <article class="forecast-position-card">
      <div class="forecast-position-label">Projected P&amp;L Position</div>
      <div class="forecast-position-value">${forecastFormatMoney(snapshot.operatingResult)}</div>
      <div class="forecast-position-detail">
        Full-year booking of <strong>${forecastFormatMoney(snapshot.fullYearBooking)}</strong> against annual cost of <strong>${forecastFormatMoney(snapshot.annualCost)}</strong>.
        Projected operating margin is <strong>${formatPercent(snapshot.operatingMargin)}</strong>.
      </div>
    </article>
    <article class="forecast-position-card">
      <div class="forecast-position-label">Projected Cash Position</div>
      <div class="forecast-position-value">${forecastFormatMoney(snapshot.cashSurplus)}</div>
      <div class="forecast-position-detail">
        Full-year cashing is projected at <strong>${forecastFormatMoney(snapshot.fullYearCashing)}</strong>.
        This covers <strong>${formatPercent(snapshot.cashCoverage)}</strong> of annual cost.
      </div>
    </article>
    <article class="forecast-position-card">
      <div class="forecast-position-label">Forecast Dependence</div>
      <div class="forecast-position-value">${formatPercent(snapshot.forecastBookingShare)}</div>
      <div class="forecast-position-detail">
        Forecast months contribute <strong>${forecastFormatMoney(snapshot.forecastBooking)}</strong> of booking and
        <strong>${forecastFormatMoney(snapshot.forecastCashing)}</strong> of cashing. Cash forecast share is <strong>${formatPercent(snapshot.forecastCashingShare)}</strong>.
      </div>
    </article>`;
}

function renderForecastDetailTable() {
  const metric = forecastById('forecastDetailMetric').value;
  const rows = forecastState.data[metric];
  const monthlyTotals = forecastMonthlyTotals(rows);
  const startMonthIndex = Number(forecastState.data.metadata.forecastStartMonthNumber) - 1;
  const monthLabels = monthlyTotals.map((_, offset) => FORECAST_MONTHS[startMonthIndex + offset]);
  const metricLabel = metric === 'booking' ? 'Booking' : 'Cashing';

  forecastById('forecastDetailTitle').textContent = `${metricLabel} Forecast by Owner`;
  forecastById('forecastDetailSubtitle').textContent = `${forecastState.data.metadata.forecastStartMonth}–${forecastState.data.metadata.forecastEndMonth} ${forecastState.data.metadata.year} · supplied forecast values`;
  forecastById('forecastDetailHead').innerHTML = `
    <tr>
      <th>Owner</th>
      ${monthLabels.map((month) => `<th>${month}</th>`).join('')}
      <th>Total</th>
    </tr>`;

  const bodyRows = rows.map((row) => {
    const ownerTotal = forecastSum(row.monthly);
    return `
      <tr>
        <td class="month-label">${row.owner}</td>
        ${row.monthly.map((value) => `<td class="${value ? '' : 'forecast-zero'}">${value ? forecastFormatMoney(value) : '—'}</td>`).join('')}
        <td class="bold">${forecastFormatMoney(ownerTotal)}</td>
      </tr>`;
  });

  bodyRows.push(`
    <tr class="forecast-total-row">
      <td>Total</td>
      ${monthlyTotals.map((value) => `<td>${forecastFormatMoney(value)}</td>`).join('')}
      <td>${forecastFormatMoney(forecastSum(monthlyTotals))}</td>
    </tr>`);

  forecastById('forecastDetailBody').innerHTML = bodyRows.join('');
}

function renderForecastInsights(snapshot) {
  const strongestBooking = [...snapshot.monthly.filter((row) => row.status === 'forecast')].sort((a, b) => b.booking - a.booking)[0];
  const strongestCashing = [...snapshot.monthly.filter((row) => row.status === 'forecast')].sort((a, b) => b.cashing - a.cashing)[0];
  const lowestCashPosition = [...snapshot.monthly].sort((a, b) => a.cashPosition - b.cashPosition)[0];

  const insights = [
    {
      type: snapshot.operatingResult >= 0 ? 'pos' : 'neg',
      icon: snapshot.operatingResult >= 0 ? '✅' : '⚠️',
      title: snapshot.operatingResult >= 0 ? 'Projected year-end operating profit' : 'Projected year-end operating loss',
      body: `Booking is projected to finish at ${forecastFormatMoney(snapshot.fullYearBooking)} versus annual cost of ${forecastFormatMoney(snapshot.annualCost)}, producing ${forecastFormatMoney(snapshot.operatingResult)}.`
    },
    {
      type: snapshot.cashSurplus >= 0 ? 'pos' : 'warn',
      icon: '💰',
      title: snapshot.cashSurplus >= 0 ? 'Projected cashing covers the annual cost plan' : 'Projected cashing remains below annual cost',
      body: `Projected cashing is ${forecastFormatMoney(snapshot.fullYearCashing)}, leaving a ${snapshot.cashSurplus >= 0 ? 'surplus' : 'gap'} of ${forecastFormatMoney(Math.abs(snapshot.cashSurplus))} and cash coverage of ${formatPercent(snapshot.cashCoverage)}.`
    },
    {
      type: 'info',
      icon: '📈',
      title: `${strongestBooking.month} is the strongest forecast booking month`,
      body: `${strongestBooking.month} booking is ${forecastFormatMoney(strongestBooking.booking)}. The strongest forecast cashing month is ${strongestCashing.month} at ${forecastFormatMoney(strongestCashing.cashing)}.`
    },
    {
      type: lowestCashPosition.cashPosition >= 0 ? 'info' : 'warn',
      icon: '📅',
      title: `${lowestCashPosition.month} has the weakest monthly cash position`,
      body: `Cashing less the monthly cost plan in ${lowestCashPosition.month} is ${forecastFormatMoney(lowestCashPosition.cashPosition)}. This is a monthly timing indicator, not the full-year result.`
    }
  ];

  forecastById('forecastInsightList').innerHTML = insights.map((insight) => `
    <div class="insight ${insight.type}">
      <div class="insight-icon">${insight.icon}</div>
      <div><div class="insight-title">${insight.title}</div><div class="insight-body">${insight.body}</div></div>
    </div>`).join('');
}

function renderForecastDashboard() {
  const snapshot = calculateForecastSnapshot();
  renderForecastStatus(snapshot);
  renderForecastKpis(snapshot);
  renderForecastCharts(snapshot);
  renderForecastPosition(snapshot);
  renderForecastDetailTable();
  renderForecastInsights(snapshot);

  forecastById('forecastTitle').textContent = `${snapshot.year} Full-Year Forecast`;
  forecastById('forecastSubtitle').textContent = `Actual Jan–${FORECAST_MONTHS[snapshot.actualThroughIndex]} plus forecast ${FORECAST_MONTHS[snapshot.forecastStartIndex]}–${FORECAST_MONTHS[snapshot.forecastEndIndex]} · annual cost plan ${forecastFormatMoney(snapshot.annualCost)}`;
}

async function loadForecastData(force = false) {
  if (forecastState.data && !force) {
    renderForecastDashboard();
    return;
  }

  forecastById('forecastLoading').hidden = false;
  forecastById('forecastStatusBanner').className = 'status-banner';

  try {
    await waitForActualDashboard();
    const separator = FORECAST_DATA_URL.includes('?') ? '&' : '?';
    const response = await fetch(`${FORECAST_DATA_URL}${separator}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load forecast data (${response.status} ${response.statusText}).`);
    forecastState.data = validateForecastPayload(await response.json());
    renderForecastDashboard();
  } catch (error) {
    console.error(error);
    const banner = forecastById('forecastStatusBanner');
    banner.className = 'status-banner error show';
    banner.textContent = `${error.message} Confirm that data/forecast-data.json exists and contains the approved forecast structure.`;
    forecastById('forecastKpiGrid').innerHTML = '<div class="card empty-state" style="grid-column:1/-1">Forecast data could not be loaded.</div>';
  } finally {
    forecastById('forecastLoading').hidden = true;
  }
}

function updateHeaderForForecast() {
  forecastById('dashboardTitle').textContent = 'Tech Licensing — Forecasting';
  forecastById('dashboardSubtitle').textContent = '2026 full-year outlook based on actuals and the approved forecast plan';
  forecastById('periodPill').innerHTML = '<span class="dot"></span>2026 Full-Year Forecast';
  forecastById('partialPill').hidden = true;
  forecastById('refreshButton').hidden = true;
  forecastById('exportCsvButton').hidden = true;
}

function restoreActualHeader() {
  forecastById('refreshButton').hidden = false;
  forecastById('exportCsvButton').hidden = false;
  if (parsedData) renderHeader();
}

function setDashboardTab(tabName, updateHash = true) {
  const normalizedTab = tabName === 'forecasting' ? 'forecasting' : 'actual';
  forecastState.activeTab = normalizedTab;
  forecastById('actualView').hidden = normalizedTab !== 'actual';
  forecastById('forecastView').hidden = normalizedTab !== 'forecasting';

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    const isActive = button.dataset.dashboardTab === normalizedTab;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  if (normalizedTab === 'forecasting') {
    updateHeaderForForecast();
    loadForecastData();
  } else {
    restoreActualHeader();
  }

  if (updateHash) {
    const hash = normalizedTab === 'forecasting' ? '#forecasting' : '#actual';
    history.replaceState(null, '', hash);
  }
}

function exportForecastCsv() {
  if (!forecastState.data) return;
  const snapshot = calculateForecastSnapshot();
  const rows = [
    ['Month', 'Status', 'Booking', 'Cashing', 'Monthly Cost', 'Operating Result', 'Cash Position'],
    ...snapshot.monthly.map((row) => [
      row.month,
      row.status,
      row.booking,
      row.cashing,
      row.cost,
      row.operatingResult,
      row.cashPosition
    ]),
    [],
    ['Full-Year Booking', snapshot.fullYearBooking],
    ['Full-Year Cashing', snapshot.fullYearCashing],
    ['Annual Cost', snapshot.annualCost],
    ['Operating Result', snapshot.operatingResult],
    ['Cash Surplus', snapshot.cashSurplus],
    ['Operating Margin', snapshot.operatingMargin],
    ['Cash Coverage', snapshot.cashCoverage]
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tech-licensing-${snapshot.year}-forecast.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function refreshForecast() {
  forecastById('forecastRefreshButton').disabled = true;
  try {
    await loadDashboard();
    await loadForecastData(true);
    updateHeaderForForecast();
  } finally {
    forecastById('forecastRefreshButton').disabled = false;
  }
}

function initializeForecasting() {
  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => setDashboardTab(button.dataset.dashboardTab));
  });

  forecastById('forecastDetailMetric').addEventListener('change', renderForecastDetailTable);
  forecastById('forecastRefreshButton').addEventListener('click', refreshForecast);
  forecastById('forecastExportButton').addEventListener('click', exportForecastCsv);
  window.addEventListener('hashchange', () => setDashboardTab(location.hash === '#forecasting' ? 'forecasting' : 'actual', false));

  setDashboardTab(location.hash === '#forecasting' ? 'forecasting' : 'actual', false);
}

initializeForecasting();
