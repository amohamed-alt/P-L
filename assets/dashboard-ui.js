function populateFilters() {
  const years = parsedData.reportingYears;
  const latestYear = Number(parsedData.metadata?.currentReportingYear) || Math.max(...years);
  const previousYear = Number(parsedData.metadata?.previousReportingYear) || years.filter((year) => year < latestYear).at(-1) || years[0];

  const yearOptions = years.map((year) => `<option value="${year}">${year}</option>`).join('');
  byId('priorYear').innerHTML = yearOptions;
  byId('currentYear').innerHTML = yearOptions;
  byId('priorYear').value = String(previousYear);
  byId('currentYear').value = String(latestYear);

  const monthOptions = parsedData.months.map((month, index) => `<option value="${index}">${month}</option>`).join('');
  byId('startMonth').innerHTML = monthOptions;
  byId('endMonth').innerHTML = monthOptions;
  byId('startMonth').value = '0';
  byId('endMonth').value = String(Math.max(0, Number(parsedData.metadata?.latestDataMonthNumber || 1) - 1));
  byId('comparisonMode').value = 'available';
  byId('includePartial').checked = true;
  byId('fullYearContext').checked = true;
  byId('metricFocus').value = 'commercial';
  detectReportingPeriod();
}

function renderHeader() {
  const { prior, current } = selectedYears();
  byId('dashboardTitle').textContent = CONFIG.title;
  byId('dashboardSubtitle').textContent = `${prior} vs ${current} · ${periodLabel()} comparison`;
  byId('periodPill').innerHTML = `<span class="dot"></span>${periodLabel()} · ${prior} vs ${current}`;

  const partialPill = byId('partialPill');
  const partialIndexes = parsedData.partial[String(current)] || [];
  const partialIndex = partialIndexes.findIndex(Boolean);
  if (partialIndex >= 0) {
    partialPill.hidden = false;
    partialPill.textContent = `⚠ ${parsedData.months[partialIndex]} ${current} is partial${byId('includePartial').checked ? ' and included' : ' and excluded'}`;
  } else {
    partialPill.hidden = true;
  }
}

function renderFilterSummary() {
  const { prior, current } = selectedYears();
  const modeText = {
    available: 'available YTD',
    closed: 'closed months only',
    custom: 'custom range'
  }[byId('comparisonMode').value];
  const context = byId('fullYearContext').checked ? 'Full-year 2025 context is visible in charts and table.' : 'Only the selected months are displayed.';
  byId('filterSummary').textContent = `${prior} vs ${current} · ${periodLabel()} · ${modeText}. ${context}`;
}

function renderDataQuality() {
  const banner = byId('statusBanner');
  const warnings = [...parsedData.warnings];
  const { current } = selectedYears();
  const partialIndexes = parsedData.partial[String(current)] || [];
  const partialIndex = partialIndexes.findIndex(Boolean);

  if (partialIndex >= 0) {
    if (byId('includePartial').checked && periodIndexes().includes(partialIndex)) {
      warnings.unshift(`${parsedData.months[partialIndex]} ${current} is shown as MTD. Its cost values are incomplete, so cost, operating-result, and coverage metrics may be temporarily distorted.`);
    } else {
      warnings.unshift(`${parsedData.months[partialIndex]} ${current} is available as MTD but excluded from the selected comparison.`);
    }
  }

  const missingSelectedMonths = periodIndexes().filter((index) => !monthHasData(current, index));
  if (missingSelectedMonths.length) {
    warnings.push(`${missingSelectedMonths.map((index) => parsedData.months[index]).join(', ')} has no ${current} data and is treated as unavailable, not as confirmed zero performance.`);
  }

  const generatedAt = parsedData.metadata?.generatedAt
    ? new Date(parsedData.metadata.generatedAt).toLocaleString()
    : 'Not provided';

  if (!warnings.length) {
    banner.className = 'status-banner info show';
    banner.textContent = `${CONFIG.refreshLabel || 'Dashboard data loaded successfully.'} Last n8n update: ${generatedAt}.`;
    return;
  }

  banner.className = 'status-banner warn show';
  banner.textContent = `Reporting note: ${warnings.join(' ')} Last n8n update: ${generatedAt}.`;
}

function renderKpis(snapshot) {
  const definitions = [
    { key: 'booking', label: 'Booking', accent: '#173f2e', kind: 'amount' },
    { key: 'cashing', label: 'Cashing', accent: '#2d6a4f', kind: 'amount' },
    { key: 'totalCost', label: 'Total Cost', accent: '#7c3aed', kind: 'amount' },
    { key: 'operatingResult', label: 'Operating Result', accent: '#dc2626', kind: 'amount' },
    { key: 'cashCoverage', label: 'Cash Coverage', accent: '#ea580c', kind: 'ratio' },
    { key: 'bookingToCash', label: 'Booking-to-Cash', accent: '#2563eb', kind: 'ratio' }
  ];

  const prior = snapshot.years[snapshot.priorYear];
  const current = snapshot.years[snapshot.currentYear];
  const focusedMetric = byId('metricFocus').value;

  byId('kpiGrid').innerHTML = definitions.map((definition) => {
    const currentValue = current[definition.key];
    const priorValue = prior[definition.key];
    const variance = getVariance(currentValue, priorValue);
    const status = statusFor(definition.key, currentValue, priorValue);
    const isRatio = definition.kind === 'ratio';
    const displayCurrent = isRatio ? formatPercent(currentValue) : formatCompact(currentValue, 2, { currency: true });
    const displayPrior = isRatio ? formatPercent(priorValue) : formatCompact(priorValue, 2, { currency: true });
    const varianceText = isRatio ? formatPoints(variance.absolute) : signedCompact(variance.absolute);
    const directionClass = status.positive ? 'up' : 'down';
    const arrow = variance.absolute >= 0 ? '↑' : '↓';
    const badgeText = isRatio
      ? status.label
      : variance.percent === null
        ? status.label
        : `${variance.percent >= 0 ? '+' : ''}${formatPercent(variance.percent)}`;
    const isFocused = focusedMetric === definition.key || (focusedMetric === 'commercial' && ['booking', 'cashing'].includes(definition.key));

    return `
      <article class="kpi ${isFocused ? 'is-focused' : ''}" style="--kpi-accent:${definition.accent}">
        <span class="badge ${status.className}">${badgeText}</span>
        <div class="kpi-label">${definition.label}</div>
        <div class="kpi-val">${displayCurrent}</div>
        <div class="kpi-prior">${snapshot.priorYear}: ${displayPrior}</div>
        <div class="kpi-var ${directionClass}"><span>${arrow}</span>${varianceText}</div>
      </article>`;
  }).join('');
}
