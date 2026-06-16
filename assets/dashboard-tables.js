function renderCoverage(snapshot) {
  const priorYear = snapshot.priorYear;
  const currentYear = snapshot.currentYear;
  const current = snapshot.years[currentYear];
  const prior = snapshot.years[priorYear];

  if (!current.hasData) {
    byId('coveragePanel').innerHTML = `
      <div class="empty-state">
        No ${currentYear} data is available for ${periodLabel()}. Choose another month range to calculate coverage and conversion.
      </div>`;
    return;
  }

  const coverageDelta = current.cashCoverage !== null && prior.hasData && prior.cashCoverage !== null
    ? current.cashCoverage - prior.cashCoverage
    : null;
  const conversionDelta = current.bookingToCash !== null && prior.hasData && prior.bookingToCash !== null
    ? current.bookingToCash - prior.bookingToCash
    : null;
  const messageClass = coverageDelta !== null && coverageDelta >= 0 ? 'pos' : 'warn';
  const message = !prior.hasData
    ? `${priorYear} baseline data is unavailable for the selected period.`
    : coverageDelta === null
      ? 'Coverage comparison is unavailable because a denominator is zero.'
      : `${coverageDelta >= 0 ? '▲' : '▼'} ${formatPoints(coverageDelta)} ${coverageDelta >= 0 ? 'improvement' : 'decline'} in cash coverage.`;

  byId('coveragePanel').innerHTML = `
    <div class="coverage-header"><span style="color:var(--slate400)">${priorYear} Cash Coverage</span><strong>${prior.hasData ? formatPercent(prior.cashCoverage) : '—'}</strong></div>
    <div class="cov-bar-wrap"><div class="cov-bar" style="width:${prior.hasData ? Math.max(0, Math.min(100, (prior.cashCoverage || 0) * 100)) : 0}%;background:var(--slate300)"></div></div>
    <div class="coverage-header" style="margin-top:15px"><span style="color:var(--forest)">${currentYear} Cash Coverage</span><strong style="font-size:17px;color:var(--forest)">${formatPercent(current.cashCoverage)}</strong></div>
    <div class="cov-bar-wrap" style="height:14px"><div class="cov-bar" style="width:${Math.max(0, Math.min(100, (current.cashCoverage || 0) * 100))}%;background:var(--forest)"></div></div>
    <div class="coverage-message ${messageClass}">${message}</div>
    <div style="margin-top:11px;padding:11px 12px;background:var(--slate50);border:1px solid var(--slate200);border-radius:8px">
      <div style="font-size:10px;color:var(--slate400);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Booking-to-Cash Conversion</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--slate400)">${priorYear}</span><strong>${prior.hasData ? formatPercent(prior.bookingToCash) : '—'}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--forest)"><span>${currentYear}</span><span>${formatPercent(current.bookingToCash)} <small style="font-size:10px;color:${conversionDelta !== null && conversionDelta >= 0 ? 'var(--emerald)' : 'var(--red)'}">${conversionDelta === null ? '' : formatPoints(conversionDelta)}</small></span></div>
    </div>`;
}

function renderMatrix(snapshot) {
  const tbody = byId('matrixTable');
  const priorYear = snapshot.priorYear;
  const currentYear = snapshot.currentYear;
  const indexes = displayIndexes();

  byId('tablePriorBooking').textContent = `${priorYear} Booking`;
  byId('tableCurrentBooking').textContent = `${currentYear} Booking`;
  byId('tablePriorCashing').textContent = `${priorYear} Cashing`;
  byId('tableCurrentCashing').textContent = `${currentYear} Cashing`;
  byId('tableCurrentCost').textContent = `${currentYear} Total Cost`;
  byId('tableCurrentResult').textContent = `${currentYear} Op. Result`;

  const bookingPrior = getMetricSeries('booking', priorYear);
  const bookingCurrent = getMetricSeries('booking', currentYear);
  const cashingPrior = getMetricSeries('cashing', priorYear);
  const cashingCurrent = getMetricSeries('cashing', currentYear);
  const totalCostCurrent = getMetricSeries('totalCost', currentYear);
  const operatingCurrent = getMetricSeries('operatingResult', currentYear);

  const rows = indexes.map((index) => {
    const priorAvailable = monthHasData(priorYear, index);
    const currentAvailable = monthHasData(currentYear, index);
    const isPartial = monthIsPartial(currentYear, index);

    const priorBookingValue = priorAvailable ? bookingPrior[index] : null;
    const currentBookingValue = currentAvailable ? bookingCurrent[index] : null;
    const priorCashingValue = priorAvailable ? cashingPrior[index] : null;
    const currentCashingValue = currentAvailable ? cashingCurrent[index] : null;
    const currentCostValue = currentAvailable ? totalCostCurrent[index] : null;
    const currentOperatingValue = currentAvailable ? operatingCurrent[index] : null;

    const bookingVariance = priorAvailable && currentAvailable ? currentBookingValue - priorBookingValue : null;
    const bookingYoY = bookingVariance !== null && priorBookingValue
      ? bookingVariance / Math.abs(priorBookingValue)
      : null;
    const cashVariance = priorAvailable && currentAvailable ? currentCashingValue - priorCashingValue : null;

    const displayMoney = (value, available, bold = false) => available
      ? `<td class="${bold ? 'bold' : ''}">${formatFull(value)}</td>`
      : '<td class="muted">—</td>';

    return `
      <tr>
        <td class="month-label">${parsedData.months[index]}${isPartial ? ' <span class="badge watch" style="float:none">MTD</span>' : ''}</td>
        ${displayMoney(priorBookingValue, priorAvailable)}
        ${displayMoney(currentBookingValue, currentAvailable, true)}
        <td class="${bookingVariance === null ? 'muted' : bookingVariance >= 0 ? 'pos' : 'neg'}">${bookingVariance === null ? '—' : signedCompact(bookingVariance)}</td>
        <td class="${bookingYoY === null ? 'muted' : bookingYoY >= 0 ? 'pos' : 'neg'}">${bookingYoY === null ? '—' : `${bookingYoY >= 0 ? '+' : ''}${formatPercent(bookingYoY)}`}</td>
        ${displayMoney(priorCashingValue, priorAvailable)}
        ${displayMoney(currentCashingValue, currentAvailable, true)}
        <td class="${cashVariance === null ? 'muted' : cashVariance >= 0 ? 'pos' : 'neg'}">${cashVariance === null ? '—' : signedCompact(cashVariance)}</td>
        ${displayMoney(currentCostValue, currentAvailable)}
        <td class="${currentOperatingValue === null ? 'muted' : currentOperatingValue >= 0 ? 'pos bold' : 'neg bold'}">${currentOperatingValue === null ? '—' : formatFull(currentOperatingValue)}</td>
      </tr>`;
  });

  const current = snapshot.years[currentYear];
  const prior = snapshot.years[priorYear];

  if (!current.hasData && !prior.hasData) {
    rows.push(`
      <tr class="total-row">
        <td>${periodLabel()} Total</td>
        <td colspan="9" class="muted" style="text-align:center">No data is available for either selected year in this period.</td>
      </tr>`);
  } else {
    const bookingVariance = current.hasData && prior.hasData ? current.booking - prior.booking : null;
    const bookingYoY = bookingVariance !== null && prior.booking ? bookingVariance / Math.abs(prior.booking) : null;
    const cashVariance = current.hasData && prior.hasData ? current.cashing - prior.cashing : null;

    rows.push(`
      <tr class="total-row">
        <td style="color:var(--forest)">${periodLabel()} Total</td>
        <td>${prior.hasData ? formatFull(prior.booking) : '—'}</td>
        <td class="bold">${current.hasData ? formatFull(current.booking) : '—'}</td>
        <td class="${bookingVariance === null ? 'muted' : bookingVariance >= 0 ? 'pos' : 'neg'}">${bookingVariance === null ? '—' : signedCompact(bookingVariance)}</td>
        <td class="${bookingYoY === null ? 'muted' : bookingYoY >= 0 ? 'pos' : 'neg'}">${bookingYoY === null ? '—' : `${bookingYoY >= 0 ? '+' : ''}${formatPercent(bookingYoY)}`}</td>
        <td>${prior.hasData ? formatFull(prior.cashing) : '—'}</td>
        <td class="bold">${current.hasData ? formatFull(current.cashing) : '—'}</td>
        <td class="${cashVariance === null ? 'muted' : cashVariance >= 0 ? 'pos' : 'neg'}">${cashVariance === null ? '—' : signedCompact(cashVariance)}</td>
        <td>${current.hasData ? formatFull(current.totalCost) : '—'}</td>
        <td class="${!current.hasData ? 'muted' : current.operatingResult >= 0 ? 'pos' : 'neg'} bold">${current.hasData ? formatFull(current.operatingResult) : '—'}</td>
      </tr>`);
  }

  tbody.innerHTML = rows.join('');
  byId('matrixSubtitle').textContent = byId('fullYearContext').checked
    ? `Full ${priorYear} baseline context is shown. ${currentYear} months without data are blank; ${periodLabel()} drives the total row and KPI comparison.`
    : `${periodLabel()} · ${priorYear} baseline vs ${currentYear} comparison.`;
}

function monthlyRecords(indexes, priorYear, currentYear) {
  const bookingPrior = getMetricSeries('booking', priorYear);
  const bookingCurrent = getMetricSeries('booking', currentYear);
  const cashingCurrent = getMetricSeries('cashing', currentYear);
  const cogsCurrent = getMetricSeries('cogs', currentYear);
  const totalCostCurrent = getMetricSeries('totalCost', currentYear);
  const operatingCurrent = getMetricSeries('operatingResult', currentYear);

  return indexes
    .filter((index) => monthHasData(currentYear, index))
    .map((index) => ({
      index,
      month: parsedData.months[index],
      bookingPrior: bookingPrior[index],
      bookingCurrent: bookingCurrent[index],
      cashingCurrent: cashingCurrent[index],
      cogsCurrent: cogsCurrent[index],
      totalCost: totalCostCurrent[index],
      operatingResult: operatingCurrent[index]
    }));
}
