import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, ChartNoAxesCombined, ChevronDown, Database, Download, Filter, Gauge, Menu, Printer, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { buildMonthlyRows, buildSnapshot, calculateForecast, defaultFilters, downloadCsv, normalizeDashboard } from './dashboard';
import { ACTUAL_NAV, ErrorScreen, FilterPanel, LoadingScreen, StatusBadge, shortTimestamp } from './ui';
import { ActualDashboard } from './ActualDashboard';
import { ForecastDashboard } from './ForecastDashboard';

const TALENTERA_LOGO_URL = 'https://talimg1.b8cdn.com/wp-content/themes/talentera-2018/images/new-design/Talentera-ATS-white-logo.svg';

export function App() {
  const [data, setData] = useState(null);
  const [forecastPayload, setForecastPayload] = useState(null);
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState(() => (window.location.hash.includes('forecast') ? 'forecast' : 'actual'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const suffix = refreshKey ? `?refresh=${Date.now()}` : '';
      const [actualResponse, forecastResponse] = await Promise.all([
        fetch(`/data/dashboard-data.json${suffix}`, { cache: 'no-store' }),
        fetch(`/data/forecast-data.json${suffix}`, { cache: 'no-store' }),
      ]);
      if (!actualResponse.ok) throw new Error(`Actual dashboard data returned ${actualResponse.status}.`);
      const normalized = normalizeDashboard(await actualResponse.json());
      setData(normalized);
      setFilters((current) => current || defaultFilters(normalized));
      if (forecastResponse.ok) setForecastPayload(await forecastResponse.json());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    const onHash = () => setView(window.location.hash.includes('forecast') ? 'forecast' : 'actual');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const switchView = (nextView) => {
    setView(nextView);
    window.location.hash = nextView === 'forecast' ? 'forecasting' : 'actual';
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const snapshot = useMemo(() => data && filters ? buildSnapshot(data, filters) : null, [data, filters]);
  const monthlyRows = useMemo(() => data && filters ? buildMonthlyRows(data, filters) : [], [data, filters]);
  const forecast = useMemo(() => data && forecastPayload ? calculateForecast(data, forecastPayload) : null, [data, forecastPayload]);

  const exportCurrent = () => {
    if (view === 'forecast' && forecast) {
      downloadCsv(`pnl-forecast-${forecast.year}.csv`, [['Month', 'Status', 'Booking', 'Cashing', 'Cost'], ...forecast.monthly.map((row) => [row.month, row.status, row.booking, row.cashing, row.cost])]);
      return;
    }
    if (!data || !filters) return;
    downloadCsv(`pnl-${filters.baselineYear}-vs-${filters.comparisonYear}.csv`, [
      ['Month', `${filters.baselineYear} Booking`, `${filters.comparisonYear} Booking`, `${filters.baselineYear} Cashing`, `${filters.comparisonYear} Cashing`, `${filters.comparisonYear} Total Cost`, `${filters.comparisonYear} Cash Coverage`],
      ...monthlyRows.map((row) => [row.month, row.baseline.booking, row.comparison.booking, row.baseline.cashing, row.comparison.cashing, row.comparison.totalCost, row.comparison.cashCoverage]),
    ]);
  };

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen message={error} onRetry={() => setRefreshKey((value) => value + 1)} />;
  if (!data || !filters || !snapshot) return null;

  const generatedAt = data.metadata.ingestedAt || data.metadata.generatedAt;
  const partialMonth = data.rows.find((row) => row.year === filters.comparisonYear && row.isPartial);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><img className="brand-logo" src={TALENTERA_LOGO_URL} alt="Talentera" /><span>Finance intelligence</span></div>
        <div className="nav-label">P&amp;L ANALYTICS</div>
        <nav>
          <button type="button" className={view === 'actual' ? 'active' : ''} onClick={() => switchView('actual')}><Gauge size={17} /><span>Actual Performance</span></button>
          {view === 'actual' && ACTUAL_NAV.map((item) => { const Icon = item.icon; return <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)}><Icon size={16} /><span>{item.label}</span></a>; })}
          <button type="button" className={view === 'forecast' ? 'active' : ''} onClick={() => switchView('forecast')}><ChartNoAxesCombined size={17} /><span>Forecasting</span></button>
        </nav>
        <div className="nav-label data-label">DATA CONNECTION</div>
        <div className="data-source-card"><Database size={17} /><div><strong>Google Sheets via n8n</strong><span>Runtime data · no Git deploy</span></div><i /></div>
        <div className="sidebar-footer"><ShieldCheck size={16} /><div><strong>Secure ingest API</strong><span>Last update {shortTimestamp(generatedAt)}</span></div></div>
        <button className="mobile-close" type="button" onClick={() => setMobileOpen(false)}><X size={20} /></button>
      </aside>

      {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      <header className="topbar">
        <div className="top-title"><button className="mobile-menu" type="button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><strong>Tech Licensing P&amp;L Command Center</strong><span>Executive performance and full-year outlook</span></div></div>
        <div className="top-actions"><span className="live-status"><i />Live data</span><button type="button" className="icon-button" title="Print dashboard" onClick={() => window.print()}><Printer size={16} /></button><button type="button" className="icon-button" title="Export CSV" onClick={exportCurrent}><Download size={16} /></button><button type="button" className="refresh-button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /><span>Refresh</span></button></div>
      </header>

      <main className="content">
        <div className="page-title">
          <div><span className="eyebrow">{view === 'actual' ? 'EXECUTIVE PERFORMANCE' : 'PLANNING & FORECAST'}</span><h1>{view === 'actual' ? 'Actual P&L Performance' : 'Full-Year Forecast'}</h1><p>{view === 'actual' ? `${snapshot.periodLabel} ${filters.baselineYear} baseline vs ${filters.comparisonYear} comparison.` : 'Actual performance combined with the supplied commercial forecast and annual cost plan.'}</p></div>
          <div className="page-actions">{view === 'actual' && <button type="button" className={filtersOpen ? 'secondary-button active' : 'secondary-button'} onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters<ChevronDown size={14} /></button>}<StatusBadge tone="info"><CalendarRange size={13} />Updated {shortTimestamp(generatedAt)}</StatusBadge></div>
        </div>

        {view === 'actual' && <FilterPanel open={filtersOpen} data={data} filters={filters} setFilters={setFilters} onReset={() => setFilters(defaultFilters(data))} />}
        {error && <div className="warning-banner"><AlertTriangle size={19} /><div><strong>Refresh warning</strong><span>{error}. The last successfully loaded snapshot remains visible.</span></div></div>}
        {partialMonth && view === 'actual' && filters.includePartial && <div className="warning-banner"><AlertTriangle size={19} /><div><strong>{partialMonth.month} {filters.comparisonYear} is partial and included</strong><span>Use “Closed months only” for a like-for-like closed-period comparison.</span></div></div>}
        {view === 'actual' ? <ActualDashboard data={data} filters={filters} snapshot={snapshot} monthlyRows={monthlyRows} setFilters={setFilters} /> : forecast ? <ForecastDashboard forecast={forecast} /> : <ErrorScreen message="Forecast data is not available." onRetry={() => setRefreshKey((value) => value + 1)} />}
      </main>
    </div>
  );
}
