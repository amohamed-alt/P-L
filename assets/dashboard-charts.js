    function chartDefaults() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        color: '#334155',
        animation: { duration: 450, easing: 'easeOutQuart' },
        plugins: {
          legend: { labels: { font: { size: 10 }, color: '#64748b', boxWidth: 11, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label(context) {
                const raw = Array.isArray(context.raw) ? context.raw[1] - context.raw[0] : context.raw;
                return ` ${context.dataset.label || context.label}: ${formatFull(raw, { currency: true })}`;
              }
            }
          }
        },
        elements: { bar: { borderRadius: 5 }, line: { tension: .32 } }
      };
    }

    function destroyChart(name) {
      if (charts[name]) charts[name].destroy();
    }

    function renderCharts(snapshot) {
      const indexes = snapshot.indexes;
      const labels = indexes.map((index) => parsedData.months[index]);
      const current = snapshot.years[2026];
      const prior = snapshot.years[2025];

      byId('ytdSubtitle').textContent = `${periodLabel()} · Absolute values${CONFIG.currency ? ` (${CONFIG.currency})` : ''}`;
      byId('waterfallSubtitle').textContent = `${periodLabel()} · Booking → Operating Result`;

      destroyChart('ytd');
      charts.ytd = new Chart(byId('ytdChart'), {
        type: 'bar',
        data: {
          labels: ['Booking', 'Cashing', 'COGS', 'Overheads', 'Support', 'Total Cost'],
          datasets: [
            { label: '2025', data: [prior.booking, prior.cashing, prior.cogs, prior.overheads, prior.support, prior.totalCost], backgroundColor: '#cbd5e1' },
            { label: '2026', data: [current.booking, current.cashing, current.cogs, current.overheads, current.support, current.totalCost], backgroundColor: ['#1B3A2C','#2d7a4f','#ef4444','#7c3aed','#ca8a04','#334155'] }
          ]
        },
        options: {
          ...chartDefaults(),
          scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => formatCompact(value, 1), font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
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
            backgroundColor: ['#1B3A2C','#ef4444','#7c3aed','#ca8a04', current.operatingResult >= 0 ? '#16a34a' : '#dc2626']
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
                  return ` ${context.label}: ${formatFull(value, { currency: true })}`;
                }
              }
            }
          },
          scales: {
            y: { ticks: { callback: (value) => formatCompact(value, 1), font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
            x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
          }
        }
      });

      const series = (metric, year) => indexes.map((index) => getMetricSeries(metric, year)[index] || 0);
      destroyChart('trend');
      charts.trend = new Chart(byId('trendChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Booking 2025', data: series('booking', 2025), borderColor: '#94a3b8', borderWidth: 1.5, borderDash: [5,3], pointRadius: 0 },
            { label: 'Cashing 2025', data: series('cashing', 2025), borderColor: '#cbd5e1', borderWidth: 1.5, borderDash: [5,3], pointRadius: 0 },
            { label: 'Booking 2026', data: series('booking', 2026), borderColor: '#1B3A2C', borderWidth: 2.5, pointBackgroundColor: '#1B3A2C', pointRadius: 4 },
            { label: 'Cashing 2026', data: series('cashing', 2026), borderColor: '#2d7a4f', borderWidth: 2.5, pointBackgroundColor: '#2d7a4f', pointRadius: 4 }
          ]
        },
        options: {
          ...chartDefaults(),
          scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => formatCompact(value, 1), font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
            x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
          }
        }
      });

      const totalCosts = indexes.map((index) => getMetricSeries('cogs', 2026)[index] + getMetricSeries('overheads', 2026)[index] + getMetricSeries('support', 2026)[index]);
      const operatingResults = indexes.map((index, localIndex) => getMetricSeries('booking', 2026)[index] - totalCosts[localIndex]);
      destroyChart('cost');
      charts.cost = new Chart(byId('costChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { type: 'bar', label: 'Total Cost 2026', data: totalCosts, backgroundColor: 'rgba(124,58,237,.55)' },
            { type: 'line', label: 'Operating Result 2026', data: operatingResults, borderColor: '#dc2626', borderWidth: 2.5, pointBackgroundColor: '#dc2626', pointRadius: 4 }
          ]
        },
        options: {
          ...chartDefaults(),
          scales: {
            y: { ticks: { callback: (value) => formatCompact(value, 1), font: { size: 9 }, color: '#94a3b8' }, grid: { color: (context) => context.tick.value === 0 ? '#94a3b8' : '#f1f5f9' }, border: { display: false } },
            x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
          }
        }
      });

      destroyChart('donut');
      charts.donut = new Chart(byId('donutChart'), {
        type: 'doughnut',
        data: {
          labels: ['COGS', 'Overheads', 'Support'],
          datasets: [{ data: [current.cogs, current.overheads, current.support], backgroundColor: ['#ef4444','#7c3aed','#ca8a04'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
          ...chartDefaults(),
          cutout: '66%',
          plugins: {
            ...chartDefaults().plugins,
            legend: { position: 'bottom', labels: { font: { size: 10 }, color: '#64748b', boxWidth: 10, padding: 12 } }
          }
        }
      });

      destroyChart('costComparison');
      charts.costComparison = new Chart(byId('costComparisonChart'), {
        type: 'bar',
        data: {
          labels: ['COGS', 'Overheads', 'Support'],
          datasets: [
            { label: '2025', data: [prior.cogs, prior.overheads, prior.support], backgroundColor: '#cbd5e1' },
            { label: '2026', data: [current.cogs, current.overheads, current.support], backgroundColor: ['#ef4444','#7c3aed','#ca8a04'] }
          ]
        },
        options: {
          ...chartDefaults(),
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, ticks: { callback: (value) => formatCompact(value, 1), font: { size: 9 }, color: '#94a3b8' }, grid: { color: '#f1f5f9' }, border: { display: false } },
            y: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false }, border: { display: false } }
          }
        }
      });
    }

