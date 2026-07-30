import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, FileSpreadsheet, Gauge, Layers3, LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import { MONTHS, variance } from './dashboard';

export const COLORS = {
  green: '#087a50',
  greenDark: '#0e4b3e',
  greenSoft: '#dff1e7',
  blue: '#356fbd',
  blueSoft: '#dce8fa',
  purple: '#7a55b3',
  amber: '#d98d25',
  red: '#df5a4b',
  teal: '#1aa6a0',
  slate: '#63776e',
  baseline: '#5578a6',
  baselineBooking: '#356fbd',
  baselineCashing: '#7a55b3',
};

export const ACTUAL_NAV = [
  { id: 'overview', label: 'Executive Overview', icon: Gauge },
  { id: 'monthly-performance', label: 'Monthly Performance', icon: LineChartIcon },
  { id: 'cost-structure', label: 'Cost Structure', icon: Layers3 },
  { id: 'monthly-matrix', label: 'Monthly Matrix', icon: FileSpreadsheet },
];

export function compactMoney(value, currency) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

export function fullMoney(value, currency) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function shortTimestamp(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function axisMoney(value, currency) {
  return compactMoney(value, currency).replace('.0', '');
}

export function deltaLabel(current, prior, metric, currency, includePercent = false) {
  const change = variance(current, prior);
  if (change.percent === null) return 'No baseline';
  if (metric === 'ratio') return `${change.absolute >= 0 ? '+' : ''}${(change.absolute * 100).toFixed(1)} pts`;

  const money = `${change.absolute >= 0 ? '+' : ''}${compactMoney(change.absolute, currency)}`;
  if (!includePercent) return money;

  const percent = `${change.percent >= 0 ? '+' : ''}${(change.percent * 100).toFixed(1)}%`;
  return `${money} · ${percent}`;
}

export function ChartTooltip({ active, payload, label, currency, percent = false }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((item) => item.value !== null && item.value !== undefined);
  return (
    <div className="chart-tooltip">
      {label && <strong>{label}</strong>}
      {visible.map((item, index) => (
        <div key={`${item.name}-${index}`}>
          <span style={{ background: item.color || item.stroke || item.fill }} />
          <em>{item.name}</em>
          <b>{percent ? formatPercent(item.value) : fullMoney(item.value, currency)}</b>
        </div>
      ))}
    </div>
  );
}

export function Section({ id, title, description, action, children, className = '' }) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ children, tone = 'good' }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

export function KpiCard({ label, value, helper, delta, tone, direction, icon: Icon, status }) {
  const resolvedDirection = direction || (tone === 'positive' ? 'up' : tone === 'negative' ? 'down' : 'flat');
  const DeltaIcon = resolvedDirection === 'up' ? ArrowUpRight : resolvedDirection === 'down' ? ArrowDownRight : Activity;
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-header">
        <span>{label}</span>
        <div className="kpi-icon"><Icon size={18} /></div>
      </div>
      <strong>{value}</strong>
      <div className="kpi-footer">
        <span className="kpi-delta"><DeltaIcon size={13} />{delta}</span>
        <small>{helper}</small>
      </div>
      {status && <span className="kpi-status">{status}</span>}
    </article>
  );
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-mark"><BarChart3 size={30} /></div>
      <strong>Loading P&amp;L command center</strong>
      <span>Reading the latest Google Sheets snapshot…</span>
      <div className="loading-line"><i /></div>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }) {
  return (
    <div className="loading-screen error-screen">
      <div className="loading-mark"><AlertTriangle size={30} /></div>
      <strong>Unable to load the P&amp;L dashboard</strong>
      <span>{message}</span>
      <button type="button" onClick={onRetry}><RefreshCw size={15} />Retry</button>
    </div>
  );
}

export function FilterPanel({ open, data, filters, setFilters, onReset }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <div className={`filter-panel ${open ? 'open' : ''}`}>
      <div className="filter-presets">
        <span>Quick view</span>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, mode: 'closed', startMonth: 0, endMonth: Math.max(0, Number(data.metadata.closedMonthNumber || 1) - 1), includePartial: false }))}>Closed YTD</button>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, mode: 'available', startMonth: 0, endMonth: Math.max(0, Number(data.metadata.latestDataMonthNumber || 1) - 1), includePartial: true }))}>Available YTD</button>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, mode: 'custom', startMonth: Math.max(0, Number(data.metadata.latestDataMonthNumber || 1) - 1), endMonth: Math.max(0, Number(data.metadata.latestDataMonthNumber || 1) - 1), includePartial: true }))}>Current month</button>
      </div>
      <div className="filter-grid">
        <label><span>Baseline year</span><select value={filters.baselineYear} onChange={(event) => update('baselineYear', Number(event.target.value))}>{data.years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Comparison year</span><select value={filters.comparisonYear} onChange={(event) => update('comparisonYear', Number(event.target.value))}>{data.years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Comparison basis</span><select value={filters.mode} onChange={(event) => update('mode', event.target.value)}><option value="available">Available YTD</option><option value="closed">Closed months only</option><option value="custom">Custom range</option></select></label>
        <label><span>Chart focus</span><select value={filters.metricFocus} onChange={(event) => update('metricFocus', event.target.value)}><option value="commercial">Booking & Cashing</option><option value="booking">Booking</option><option value="cashing">Cashing</option><option value="totalCost">Total Cost</option><option value="cashCoverage">Cash Coverage</option><option value="bookingToCash">Booking-to-Cash</option></select></label>
        <label><span>Start month</span><select value={filters.startMonth} onChange={(event) => update('startMonth', Number(event.target.value))}>{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label><span>End month</span><select value={filters.endMonth} onChange={(event) => update('endMonth', Number(event.target.value))}>{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label className="toggle-field"><span>Include partial month</span><button type="button" className={filters.includePartial ? 'toggle on' : 'toggle'} onClick={() => update('includePartial', !filters.includePartial)}><i /></button></label>
        <label className="toggle-field"><span>Full-year chart context</span><button type="button" className={filters.fullYearContext ? 'toggle on' : 'toggle'} onClick={() => update('fullYearContext', !filters.fullYearContext)}><i /></button></label>
      </div>
      <div className="filter-bottom"><p>Filters recalculate every KPI, chart, insight and table without changing the source data.</p><button type="button" onClick={onReset}>Reset filters</button></div>
    </div>
  );
}
