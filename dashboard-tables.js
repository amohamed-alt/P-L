    function renderCoverage(snapshot) {
      const current = snapshot.years[2026];
      const prior = snapshot.years[2025];
      const coverageDelta = current.cashCoverage !== null && prior.cashCoverage !== null ? current.cashCoverage - prior.cashCoverage : null;
      const conversionDelta = current.bookingToCash !== null && prior.bookingToCash !== null ? current.bookingToCash - prior.bookingToCash : null;
      const messageClass = coverageDelta !== null && coverageDelta >= 0 ? 'pos' : 'warn';
      const message = coverageDelta === null
        ? 'Coverage comparison is unavailable because a denominator is zero.'
        : `${coverageDelta >= 0 ? '▲' : '▼'} ${formatPoints(coverageDelta)} ${coverageDelta >= 0 ? 'improvement' : 'decline'} in cash coverage.`;

      byId('coveragePanel').innerHTML = `
        <div class="coverage-header"><span style="color:var(--slate400)">2025 Cash Coverage</span><strong>${formatPercent(prior.cashCoverage)}</strong></div>
        <div class="cov-bar-wrap"><div class="cov-bar" style="width:${Math.max(0, Math.min(100, (prior.cashCoverage || 0) * 100))}%;background:var(--slate300)"></div></div>
        <div class="coverage-header" style="margin-top:15px"><span style="color:var(--forest)">2026 Cash Coverage</span><strong style="font-size:17px;color:var(--forest)">${formatPercent(current.cashCoverage)}</strong></div>
        <div class="cov-bar-wrap" style="height:14px"><div class="cov-bar" style="width:${Math.max(0, Math.min(100, (current.cashCoverage || 0) * 100))}%;background:var(--forest)"></div></div>
        <div class="coverage-message ${messageClass}">${message}</div>
        <div style="margin-top:11px;padding:11px 12px;background:var(--slate50);border:1px solid var(--slate200);border-radius:8px">
          <div style="font-size:10px;color:var(--slate400);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Booking-to-Cash Conversion</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--slate400)">2025</span><strong>${formatPercent(prior.bookingToCash)}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--forest)"><span>2026</span><span>${formatPercent(current.bookingToCash)} <small style="font-size:10px;color:${conversionDelta >= 0 ? 'var(--emerald)' : 'var(--red)'}">${formatPoints(conversionDelta)}</small></span></div>
        </div>`;
    }

    function renderMatrix(snapshot) {
      const tbody = byId('matrixTable');
      const indexes = snapshot.indexes;
      const booking25 = getMetricSeries('booking', 2025);
      const booking26 = getMetricSeries('booking', 2026);
      const cashing25 = getMetricSeries('cashing', 2025);
      const cashing26 = getMetricSeries('cashing', 2026);
      const cogs26 = getMetricSeries('cogs', 2026);
      const overheads26 = getMetricSeries('overheads', 2026);
      const support26 = getMetricSeries('support', 2026);

      const rows = indexes.map((index) => {
        const bookingVariance = booking26[index] - booking25[index];
        const bookingYoY = booking25[index] ? bookingVariance / Math.abs(booking25[index]) : null;
        const cashVariance = cashing26[index] - cashing25[index];
        const totalCost = cogs26[index] + overheads26[index] + support26[index];
        const operatingResult = booking26[index] - totalCost;
        const isPartial = index === partialMonthIndex;
        return `
          <tr>
            <td class="month-label">${parsedData.months[index]}${isPartial ? ' <span class="badge watch" style="float:none">MTD</span>' : ''}</td>
            <td>${formatFull(booking25[index])}</td>
            <td class="bold">${formatFull(booking26[index])}</td>
            <td class="${bookingVariance >= 0 ? 'pos' : 'neg'}">${signedCompact(bookingVariance)}</td>
            <td class="${bookingYoY !== null && bookingYoY >= 0 ? 'pos' : 'neg'}">${bookingYoY === null ? '—' : `${bookingYoY >= 0 ? '+' : ''}${formatPercent(bookingYoY)}`}</td>
            <td>${formatFull(cashing25[index])}</td>
            <td class="bold">${formatFull(cashing26[index])}</td>
            <td class="${cashVariance >= 0 ? 'pos' : 'neg'}">${signedCompact(cashVariance)}</td>
            <td>${formatFull(totalCost)}</td>
            <td class="${operatingResult >= 0 ? 'pos' : 'neg'} bold">${formatFull(operatingResult)}</td>
          </tr>`;
      });

      const current = snapshot.years[2026];
      const prior = snapshot.years[2025];
      const bookingVariance = current.booking - prior.booking;
      const bookingYoY = prior.booking ? bookingVariance / Math.abs(prior.booking) : null;
      const cashVariance = current.cashing - prior.cashing;
      rows.push(`
        <tr style="background:#f8fafc;font-weight:800;border-top:2px solid #e2e8f0">
          <td style="color:var(--forest)">YTD Total</td>
          <td>${formatFull(prior.booking)}</td>
          <td class="bold">${formatFull(current.booking)}</td>
          <td class="${bookingVariance >= 0 ? 'pos' : 'neg'}">${signedCompact(bookingVariance)}</td>
          <td class="${bookingYoY !== null && bookingYoY >= 0 ? 'pos' : 'neg'}">${bookingYoY === null ? '—' : `${bookingYoY >= 0 ? '+' : ''}${formatPercent(bookingYoY)}`}</td>
          <td>${formatFull(prior.cashing)}</td>
          <td class="bold">${formatFull(current.cashing)}</td>
          <td class="${cashVariance >= 0 ? 'pos' : 'neg'}">${signedCompact(cashVariance)}</td>
          <td>${formatFull(current.totalCost)}</td>
          <td class="${current.operatingResult >= 0 ? 'pos' : 'neg'} bold">${formatFull(current.operatingResult)}</td>
        </tr>`);

      tbody.innerHTML = rows.join('');
      byId('matrixSubtitle').textContent = `${periodLabel()} equivalent-period comparison${byId('includePartial').checked ? ' including partial month' : ''}`;
    }

    function monthlyRecords(indexes) {
      const booking25 = getMetricSeries('booking', 2025);
      const booking26 = getMetricSeries('booking', 2026);
      const cashing26 = getMetricSeries('cashing', 2026);
      const cogs26 = getMetricSeries('cogs', 2026);
      const overheads26 = getMetricSeries('overheads', 2026);
      const support26 = getMetricSeries('support', 2026);
      return indexes.map((index) => {
        const totalCost = cogs26[index] + overheads26[index] + support26[index];
        return {
          index,
          month: parsedData.months[index],
          booking25: booking25[index],
          booking26: booking26[index],
          cashing26: cashing26[index],
          cogs26: cogs26[index],
          totalCost,
          operatingResult: booking26[index] - totalCost
        };
      });
    }

