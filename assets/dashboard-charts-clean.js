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
            const raw = context.raw;
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
  byId('costStructureTitle').textContent = `Cost Structure — ${currentYear}`;
  byId('costStructureSubtitle').textContent = `${periodLabel()} · COGS · Overheads · Support Allocation`;
  byId('costComparisonSubtitle').textContent = `${periodLabel()} · ${priorYear} vs ${currentYear}`;
  byId('coverageSubtitle').textContent = `${periodLabel()} · ${priorYear} vs ${currentYear}`;

  const priorComparisonValues = prior.hasData
    ? [prior.booking, prior.cashing, prior.cogs, prior.overheads, prior.support, prior.totalCost]
    : Array(6).fill(null);
  const currentComparisonValues = current.hasData
    ? [current.booking, current.cashing, current.cogs, current.overheads, current.support, current.totalCost]
    : Array(6).fill(null);

  destroyChart('ytd');
  charts.ytd = new Chart(byId('ytdChart'), {
    type: 'bar',
    data: {
      labels: ['Booking', 'Cashing', 'COGS', 'Overheads', 'Support', 'Total Cost'],
      datasets: [
        { label: String(priorYear), data: priorComparisonValues, backgroundColor: '#cbd5e1' },
        {
          label: String(currentYear),
          data: currentComparisonValues,
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
        x: {
          ticks: { font: { size: 10 }, color: '#64748b' },
          grid: { display: false },
          border: { display: false }
        }
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
          beginAtZero: true,
          ticks: {
            callback: isRatioFocus ? (value) => `${(value * 100).toFixed(0)}%` : formatAxis,
            font: { size: 9 },
            color: '#94a3b8'
          },
          grid: { color: '#f1f5f9' },
          border: { display: false }
        },
        x: {
          ticks: { font: { size: 10 }, color: '#64748b' },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });

  destroyChart('donut');
  charts.donut = new Chart(byId('donutChart'), {
    type: 'doughnut',
    data: {
      labels: ['COGS', 'Overheads', 'Support'],
      datasets: [{
        data: current.hasData ? [current.cogs, current.overheads, current.support] : [0, 0, 0],
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
        legend: {
          position: 'bottom',
          labels: { font: { size: 10 }, color: '#64748b', boxWidth: 10, padding: 12, usePointStyle: true }
        }
      }
    }
  });

  destroyChart('costComparison');
  charts.costComparison = new Chart(byId('costComparisonChart'), {
    type: 'bar',
    data: {
      labels: ['COGS', 'Overheads', 'Support'],
      datasets: [
        { label: String(priorYear), data: prior.hasData ? [prior.cogs, prior.overheads, prior.support] : [null, null, null], backgroundColor: '#cbd5e1' },
        { label: String(currentYear), data: current.hasData ? [current.cogs, current.overheads, current.support] : [null, null, null], backgroundColor: ['#ef4444', '#7c3aed', '#ca8a04'] }
      ]
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: { callback: formatAxis, font: { size: 9 }, color: '#94a3b8' },
          grid: { color: '#f1f5f9' },
          border: { display: false }
        },
        y: {
          ticks: { font: { size: 10 }, color: '#64748b' },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}
