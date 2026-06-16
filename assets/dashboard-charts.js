function chartDefaults({ ratio = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    color: '#334155',
    animation: { duration: 420, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          font: { size: 10 },
          color: '#64748b',
          boxWidth: 11,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = Array.isArray(context.raw) ? context.raw[1] - context.raw[0] : context.raw;
            if (raw === null || raw === undefined) return ` ${context.dataset.label}: unavailable`;
            return ratio
              ? ` ${context.dataset.label}: ${formatPercent(raw)}`
              : ` ${context.dataset.label || context.label}: ${formatFull(raw)}`;
          }
        }
      }
    },
    elements: { bar: { borderRadius: 5 }, line: { tension: .3, spanGaps: false } }
  };
}

function destroyChart(name) {
  if (charts[name]) charts[name].destroy();
}

function seriesForDisplay(metric, year, indexes) {
  return indexes.map((index) => valueForDisplay(metric, year, index));
}

function renderCharts(snapshot) {
  const contextIndexes = displayIndexes();
  const contextLabels = contextIndexes.map((index) => parsedData.months[index]);
  const priorYear = snapshot.priorYear;
  const currentYear = snapshot.currentYear;
  const prior = snapshot.years[priorYear];
  const current = snapshot.years[currentYear];
  const focus = byId('metricFocus').value;

  byId('ytdTitle').textContent = `Period Comparison — ${priorYear} vs ${currentYear}`;
  byId('ytdSubtitle').textContent = `${periodLabel()} · $ values · equivalent selected months`;
  byId('waterfallTitle').textContent = `Profitability Bridge — ${currentYear}`;
  byId('waterfallSubtitle').textContent = `${periodLabel()} · Booking → Operating Result`;
  byId('costStructureTitle').textContent = `Cost Structure — ${currentYear}`;
  byId('costStructureSubtitle').textContent = `${periodLabel()} · COGS · Overheads · Support Allocation`;
  byId('costComparisonSubtitle').textContent = `${periodLabel()} · ${priorYear} vs ${currentYear}`;
  byId('coverageSubtitle').textContent = `${periodLabel()} · ${priorYear} vs ${currentYear}`;

  destroyChart('ytd');
  charts.ytd = new Chart(byId('ytdChart'), {
    type: 'bar',
    data: {
      labels: ['Booking', 'Cashing', 'COGS', 'Overheads', 'Support', 'Total Cost'],
      datasets: [
        {
          label: String(priorYear),
          data: [prior.booking, prior.cashing, prior.cogs, prior.overheads, prior.support, prior.totalCost],
          backgroundColor: '#cbd5e1'
        },
        {
          label: String(currentYear),
          data: [current.booking, current.cashing, current.cogs, current.overheads, current.support, current.totalCost],
          backgroundColor: ['#173f2e', '#2d6a4f', '#ef4444', '#7c3aed', '#ca8a04', '#334155']
        }
      ]
    },
    options: {
      ...chartDefaults(),
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' },
          grid: { color: '#f1f5f9' },
          border: { display: false }
        },
        x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
      }
    }
  });

  const bridgeStart = current.booking;
  const afterCogs = bridgeStart - current.cogs;
  const afterOverheads = afterCogs - current.overheads;
  const afterSupport = afterOverheads - current.support;

  destroyChart('waterfall');
  charts.waterfall = new Chart(byId('waterfallChart'), {
    type: 'bar',
    data: {
      labels: ['Booking', 'COGS', 'Overheads', 'Support', 'Op. Result'],
      datasets: [{
        label: 'Value',
        data: [
          [0, bridgeStart],
          [afterCogs, bridgeStart],
          [afterOverheads, afterCogs],
          [afterSupport, afterOverheads],
          [0, current.operatingResult]
        ],
        backgroundColor: ['#173f2e', '#ef4444', '#7c3aed', '#ca8a04', current.operatingResult >= 0 ? '#16a34a' : '#dc2626']
      }]
    },
    options: {
      ...chartDefaults(),
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const [start, end] = context.raw;
              const value = context.dataIndex === 4 ? end : Math.abs(end - start);
              return ` ${context.label}: ${formatFull(value)}`;
            }
          }
        }
      },
      scales: {
        y: { ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
        x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
      }
    }
  });

  const commercialMode = focus === 'commercial';
  const focusedMetric = commercialMode ? 'booking' : focus;
  const focusDefinition = METRICS[focusedMetric] || METRICS.booking;
  const isRatioFocus = focusDefinition.kind === 'ratio';

  let trendDatasets;
  if (commercialMode) {
    trendDatasets = [
      { label: `Booking ${priorYear}`, data: seriesForDisplay('booking', priorYear, contextIndexes), borderColor: '#94a3b8', borderWidth: 1.7, borderDash: [5, 3], pointRadius: 2, pointBackgroundColor: '#94a3b8' },
      { label: `Cashing ${priorYear}`, data: seriesForDisplay('cashing', priorYear, contextIndexes), borderColor: '#cbd5e1', borderWidth: 1.7, borderDash: [5, 3], pointRadius: 2, pointBackgroundColor: '#cbd5e1' },
      { label: `Booking ${currentYear}`, data: seriesForDisplay('booking', currentYear, contextIndexes), borderColor: '#173f2e', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#173f2e' },
      { label: `Cashing ${currentYear}`, data: seriesForDisplay('cashing', currentYear, contextIndexes), borderColor: '#2d6a4f', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#2d6a4f' }
    ];
    byId('trendTitle').textContent = 'Monthly Booking & Cashing';
  } else {
    trendDatasets = [
      { label: `${focusDefinition.label} ${priorYear}`, data: seriesForDisplay(focusedMetric, priorYear, contextIndexes), borderColor: '#94a3b8', borderWidth: 2, borderDash: [5, 3], pointRadius: 3, pointBackgroundColor: '#94a3b8' },
      { label: `${focusDefinition.label} ${currentYear}`, data: seriesForDisplay(focusedMetric, currentYear, contextIndexes), borderColor: focusDefinition.color, borderWidth: 2.7, pointRadius: 4, pointBackgroundColor: focusDefinition.color }
    ];
    byId('trendTitle').textContent = `Monthly ${focusDefinition.label}`;
  }

  byId('trendSubtitle').textContent = byId('fullYearContext').checked
    ? `${priorYear} shown through December; ${currentYear} future months remain blank.`
    : `${periodLabel()} selected display range.`;

  destroyChart('trend');
  charts.trend = new Chart(byId('trendChart'), {
    type: 'line',
    data: { labels: contextLabels, datasets: trendDatasets },
    options: {
      ...chartDefaults({ ratio: isRatioFocus }),
      scales: {
        y: {
          beginAtZero: !['operatingResult', 'cashGap'].includes(focusedMetric),
          ticks: {
            callback: isRatioFocus ? (value) => `${(value * 100).toFixed(0)}%` : formatAxis,
            font: { size: 9 },
            color: '#94a3b8'
          },
          grid: { color: (context) => context.tick.value === 0 ? '#94a3b8' : '#f1f5f9' },
          border: { display: false }
        },
        x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
      }
    }
  });

  const priorCosts = seriesForDisplay('totalCost', priorYear, contextIndexes);
  const currentCosts = seriesForDisplay('totalCost', currentYear, contextIndexes);
  const priorResults = seriesForDisplay('operatingResult', priorYear, contextIndexes);
  const currentResults = seriesForDisplay('operatingResult', currentYear, contextIndexes);

  byId('costTitle').textContent = `Cost & Operating Result — ${priorYear} vs ${currentYear}`;
  byId('costSubtitle').textContent = byId('fullYearContext').checked
    ? `Full ${priorYear} context with ${currentYear} shown through its latest available month.`
    : `${periodLabel()} display range.`;

  destroyChart('cost');
  charts.cost = new Chart(byId('costChart'), {
    type: 'bar',
    data: {
      labels: contextLabels,
      datasets: [
        { type: 'bar', label: `Total Cost ${priorYear}`, data: priorCosts, backgroundColor: 'rgba(203,213,225,.85)' },
        { type: 'bar', label: `Total Cost ${currentYear}`, data: currentCosts, backgroundColor: 'rgba(124,58,237,.55)' },
        { type: 'line', label: `Op. Result ${priorYear}`, data: priorResults, borderColor: '#94a3b8', borderWidth: 1.8, borderDash: [5, 3], pointRadius: 2 },
        { type: 'line', label: `Op. Result ${currentYear}`, data: currentResults, borderColor: '#dc2626', borderWidth: 2.4, pointBackgroundColor: '#dc2626', pointRadius: 3.5 }
      ]
    },
    options: {
      ...chartDefaults(),
      scales: {
        y: { ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' }, grid: { color: (context) => context.tick.value === 0 ? '#94a3b8' : '#f1f5f9' }, border: { display: false } },
        x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
      }
    }
  });

  destroyChart('donut');
  charts.donut = new Chart(byId('donutChart'), {
    type: 'doughnut',
    data: {
      labels: ['COGS', 'Overheads', 'Support'],
      datasets: [{
        data: [current.cogs, current.overheads, current.support],
        backgroundColor: ['#ef4444', '#7c3aed', '#ca8a04'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      ...chartDefaults(),
      cutout: '66%',
      plugins: {
        ...chartDefaults().plugins,
        legend: { position: 'bottom', labels: { font: { size: 10 }, color: '#64748b', boxWidth: 10, padding: 12, usePointStyle: true } }
      }
    }
  });

  destroyChart('costComparison');
  charts.costComparison = new Chart(byId('costComparisonChart'), {
    type: 'bar',
    data: {
      labels: ['COGS', 'Overheads', 'Support'],
      datasets: [
        { label: String(priorYear), data: [prior.cogs, prior.overheads, prior.support], backgroundColor: '#cbd5e1' },
        { label: String(currentYear), data: [current.cogs, current.overheads, current.support], backgroundColor: ['#ef4444', '#7c3aed', '#ca8a04'] }
      ]
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
        y: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
      }
    }
  });
}
