    function renderInsightsAndRecommendations(snapshot) {
      const current = snapshot.years[2026];
      const prior = snapshot.years[2025];
      const records = monthlyRecords(snapshot.indexes);
      const bookingVariance = getVariance(current.booking, prior.booking);
      const cashingVariance = getVariance(current.cashing, prior.cashing);
      const cogsVariance = getVariance(current.cogs, prior.cogs);
      const overheadVariance = getVariance(current.overheads, prior.overheads);
      const supportVariance = getVariance(current.support, prior.support);
      const operatingImprovement = current.operatingResult - prior.operatingResult;
      const receivablesGap = current.booking - current.cashing;
      const bestMonth = [...records].sort((a, b) => b.booking26 - a.booking26)[0];
      const weakestMonth = [...records].sort((a, b) => a.booking26 - b.booking26)[0];
      const averageMonthlyCost = snapshot.indexes.length ? current.totalCost / snapshot.indexes.length : 0;
      const monthlyBreakEvenGap = snapshot.indexes.length ? Math.max(0, -current.operatingResult / snapshot.indexes.length) : 0;

      const insights = [
        {
          type: cashingVariance.percent !== null && bookingVariance.percent !== null && cashingVariance.percent > bookingVariance.percent ? 'pos' : 'info',
          icon: '📈',
          title: 'Commercial growth and collection performance',
          body: `Booking changed ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} YoY to ${formatCompact(current.booking)}, while cashing changed ${cashingVariance.percent === null ? '—' : formatPercent(cashingVariance.percent)} to ${formatCompact(current.cashing)}. Booking-to-cash conversion moved from ${formatPercent(prior.bookingToCash)} to ${formatPercent(current.bookingToCash)}.`
        },
        {
          type: current.operatingResult >= 0 ? 'pos' : (operatingImprovement > 0 ? 'pos' : 'neg'),
          icon: current.operatingResult >= 0 ? '✅' : '⚖️',
          title: current.operatingResult >= 0 ? 'Business is above operating break-even' : 'Operating result is still below break-even',
          body: `The 2026 operating result is ${formatFull(current.operatingResult, { currency: true })}. This is ${operatingImprovement >= 0 ? 'an improvement of' : 'a decline of'} ${formatCompact(Math.abs(operatingImprovement))} compared with 2025.`
        },
        {
          type: cogsVariance.percent !== null && cogsVariance.percent > 0.15 ? 'neg' : 'info',
          icon: '⚠️',
          title: 'COGS movement requires management review',
          body: `COGS changed ${cogsVariance.percent === null ? '—' : formatPercent(cogsVariance.percent)} YoY to ${formatCompact(current.cogs)}. Compare this movement against booking growth of ${bookingVariance.percent === null ? '—' : formatPercent(bookingVariance.percent)} to confirm whether the increase is volume-driven or margin dilution.`
        },
        {
          type: overheadVariance.absolute <= 0 && supportVariance.absolute <= 0 ? 'pos' : 'warn',
          icon: '💡',
          title: 'Fixed-cost discipline',
          body: `Overheads changed ${overheadVariance.percent === null ? '—' : formatPercent(overheadVariance.percent)} and support allocation changed ${supportVariance.percent === null ? '—' : formatPercent(supportVariance.percent)} versus the same 2025 period.`
        },
        {
          type: 'warn',
          icon: '📅',
          title: `${bestMonth?.month || '—'} is the strongest booking month`,
          body: `${bestMonth?.month || '—'} delivered ${formatCompact(bestMonth?.booking26 || 0)} in booking. ${weakestMonth?.month || '—'} is the weakest month at ${formatCompact(weakestMonth?.booking26 || 0)}, creating a useful pattern for pipeline and deal-mix review.`
        },
        {
          type: receivablesGap > 0 ? 'info' : 'pos',
          icon: '💰',
          title: receivablesGap > 0 ? 'Booking-to-cash gap remains outstanding' : 'Cashing exceeds booking',
          body: `The cumulative booking-to-cash gap is ${formatFull(receivablesGap, { currency: true })}. Cash coverage currently stands at ${formatPercent(current.cashCoverage)}.`
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
          priority: 'High Priority', priorityClass: 'p1',
          body: `COGS changed ${cogsVariance.percent === null ? '—' : formatPercent(cogsVariance.percent)} YoY. Reconcile vendor, delivery, implementation, and allocation drivers before the next forecast cycle.`
        },
        {
          title: 'Set a formal monthly break-even booking floor',
          priority: 'High Priority', priorityClass: 'p1',
          body: `Average monthly cost is approximately ${formatCompact(averageMonthlyCost)}. Add the current average monthly shortfall of ${formatCompact(monthlyBreakEvenGap)} and set the operating floor above that amount.`
        },
        {
          title: 'Accelerate collection of the booking-to-cash gap',
          priority: 'Medium', priorityClass: 'p2',
          body: `The outstanding gap is ${formatCompact(receivablesGap)}. Review overdue invoices weekly and track conversion toward a management target above the current ${formatPercent(current.bookingToCash)}.`
        },
        {
          title: `Replicate the ${bestMonth?.month || 'best-month'} pipeline conditions`,
          priority: 'Medium', priorityClass: 'p2',
          body: `Review deal source, product mix, owner contribution, pricing, and close timing behind ${bestMonth?.month || 'the strongest month'} to turn a one-off peak into a repeatable playbook.`
        },
        {
          title: 'Keep the dashboard data cutoff controlled',
          priority: 'Operational', priorityClass: 'p3',
          body: partialMonthIndex >= 0
            ? `${parsedData.months[partialMonthIndex]} is automatically treated as partial. Complete the cost allocation before using it in the official closed-period comparison.`
            : 'Maintain a documented monthly close date so management always compares equivalent and complete periods.'
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
      const snapshot = calculateSnapshot();
      renderHeader();
      renderDataQuality();
      renderKpis(snapshot);
      renderCharts(snapshot);
      renderCoverage(snapshot);
      renderMatrix(snapshot);
      renderInsightsAndRecommendations(snapshot);
    }

    async function loadDashboard() {
      byId('loadingOverlay').classList.remove('hidden');
      byId('statusBanner').className = 'status-banner';

      try {
        const separator = CONFIG.dataUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${CONFIG.dataUrl}${separator}v=${Date.now()}`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Unable to load dashboard JSON (${response.status} ${response.statusText}).`);
        }

        const payload = await response.json();
        parsedData = normalizeDashboardJson(payload);
        detectReportingPeriod();

        if (latestDataMonthIndex < 0) {
          throw new Error('The JSON does not contain any 2026 reporting values.');
        }

        renderDashboard();
      } catch (error) {
        console.error(error);

        const banner = byId('statusBanner');
        banner.className = 'status-banner error show';
        banner.textContent = `${error.message} Confirm that data/dashboard-data.json exists on the main branch and that GitHub Pages is publishing the repository.`;

        byId('kpiGrid').innerHTML =
          '<div class="card empty-state" style="grid-column:1/-1">Dashboard data could not be loaded.</div>';
      } finally {
        byId('loadingOverlay').classList.add('hidden');
      }
    }

    byId('includePartial').addEventListener('change', renderDashboard);
    byId('refreshButton').addEventListener('click', loadDashboard);
    byId('printButton').addEventListener('click', () => window.print());
    loadDashboard();
