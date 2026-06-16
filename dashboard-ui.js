    function renderHeader() {
      byId('dashboardTitle').textContent = CONFIG.title;
      byId('dashboardSubtitle').textContent = `${CONFIG.subtitle} · ${periodLabel()} equivalent-period comparison`;
      byId('periodPill').innerHTML = `<span class="dot"></span>${periodLabel()} 2026 ${byId('includePartial').checked ? 'including MTD' : 'closed period'}`;

      const partialPill = byId('partialPill');
      const toggleWrap = byId('partialToggleWrap');
      if (partialMonthIndex >= 0) {
        partialPill.hidden = false;
        toggleWrap.hidden = false;
        partialPill.textContent = `⚠ ${parsedData.months[partialMonthIndex]} 2026 detected as partial`;
      } else {
        partialPill.hidden = true;
        toggleWrap.hidden = true;
      }
    }

    function renderDataQuality() {
      const banner = byId('statusBanner');
      const warnings = [...parsedData.warnings];
      if (partialMonthIndex >= 0) {
        warnings.unshift(`${parsedData.months[partialMonthIndex]} 2026 has commercial activity but unusually low or missing cost values, so it is excluded by default.`);
      }

      if (!warnings.length) {
        banner.className = 'status-banner info show';
        const generatedAt = parsedData.metadata?.generatedAt
          ? new Date(parsedData.metadata.generatedAt).toLocaleString()
          : 'Not provided';
        banner.textContent = `${CONFIG.refreshLabel || 'Dashboard data loaded successfully.'} Last n8n update: ${generatedAt}. Source: ${CONFIG.dataUrl}`;
        return;
      }

      banner.className = 'status-banner warn show';
      banner.textContent = `Reporting note: ${warnings.join(' ')}`;
    }

    function renderKpis(snapshot) {
      const definitions = [
        { key: 'booking', label: 'Booking', accent: '#1B3A2C', kind: 'amount' },
        { key: 'cashing', label: 'Cashing', accent: '#2d7a4f', kind: 'amount' },
        { key: 'totalCost', label: 'Total Cost', accent: '#7c3aed', kind: 'amount' },
        { key: 'operatingResult', label: 'Operating Result', accent: '#dc2626', kind: 'amount' },
        { key: 'cashCoverage', label: 'Cash Coverage', accent: '#ea580c', kind: 'ratio' },
        { key: 'bookingToCash', label: 'Booking-to-Cash', accent: '#2563eb', kind: 'ratio' }
      ];

      byId('kpiGrid').innerHTML = definitions.map((definition) => {
        const current = snapshot.years[2026][definition.key];
        const prior = snapshot.years[2025][definition.key];
        const variance = getVariance(current, prior);
        const status = statusFor(definition.key, current, prior);
        const isRatio = definition.kind === 'ratio';
        const displayCurrent = isRatio ? formatPercent(current) : formatCompact(current);
        const displayPrior = isRatio ? formatPercent(prior) : formatCompact(prior);
        const varianceText = isRatio ? formatPoints(variance.absolute) : signedCompact(variance.absolute);
        const directionClass = status.positive ? 'up' : 'down';
        const arrow = variance.absolute >= 0 ? '↑' : '↓';
        const percentageBadge = isRatio ? status.label : (variance.percent === null ? status.label : `${variance.percent >= 0 ? '+' : ''}${formatPercent(variance.percent)}`);

        return `
          <article class="kpi" style="--kpi-accent:${definition.accent}">
            <span class="badge ${status.className}">${percentageBadge}</span>
            <div class="kpi-label">${definition.label}</div>
            <div class="kpi-val">${displayCurrent}</div>
            <div class="kpi-prior">2025: ${displayPrior}</div>
            <div class="kpi-var ${directionClass}"><span>${arrow}</span>${varianceText}</div>
          </article>`;
      }).join('');
    }

