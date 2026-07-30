import { BadgeDollarSign, ChartNoAxesCombined, CircleDollarSign, Coins, ShieldCheck, Target, WalletCards } from 'lucide-react';
import { generateInsights, statusFor, variance } from './dashboard';
import { KpiCard, StatusBadge, compactMoney, deltaLabel, formatPercent } from './ui';
import { CostComparison, CostDonut, CoveragePanel, MonthlyPerformance, PeriodComparison } from './ActualCharts';
import { Insights, MonthlyMatrix } from './ActualDetails';

export function ActualDashboard({ data, filters, snapshot, monthlyRows, setFilters }) {
  const currency = data.currency;
  const metrics = [
    { key: 'booking', label: 'Booking', icon: BadgeDollarSign, value: snapshot.comparison.booking, prior: snapshot.baseline.booking, helper: `${snapshot.periodLabel} ${filters.comparisonYear}` },
    { key: 'cashing', label: 'Cashing', icon: WalletCards, value: snapshot.comparison.cashing, prior: snapshot.baseline.cashing, helper: `${formatPercent(snapshot.comparison.bookingToCash)} of booking` },
    { key: 'totalCost', label: 'Total Cost', icon: Coins, value: snapshot.comparison.totalCost, prior: snapshot.baseline.totalCost, helper: 'COGS + overheads + support' },
    { key: 'cashGap', label: 'Cash Position', icon: CircleDollarSign, value: snapshot.comparison.cashGap, prior: snapshot.baseline.cashGap, helper: 'Cashing less total cost' },
    { key: 'ratio', metric: 'cashCoverage', label: 'Cash Coverage', icon: ShieldCheck, value: snapshot.comparison.cashCoverage, prior: snapshot.baseline.cashCoverage, helper: 'Cashing ÷ total cost' },
    { key: 'ratio', metric: 'bookingToCash', label: 'Booking-to-Cash', icon: Target, value: snapshot.comparison.bookingToCash, prior: snapshot.baseline.bookingToCash, helper: 'Cashing ÷ booking' },
  ];
  const insights = generateInsights(data, filters, snapshot);

  return (
    <>
      <div className="section-intro">
        <div className="intro-icon"><ChartNoAxesCombined size={22} /></div>
        <div><strong>{snapshot.periodLabel} executive comparison</strong><span>{filters.baselineYear} baseline against {filters.comparisonYear}. All components below respond to the comparison controls.</span></div>
        <StatusBadge tone={snapshot.comparison.completeForPeriod ? 'good' : 'warning'}>{snapshot.comparison.availableMonthCount}/{snapshot.comparison.requestedMonthCount} months available</StatusBadge>
      </div>

      <section id="overview" className="kpi-grid">
        {metrics.map((metric) => {
          const current = Number(metric.value || 0);
          const prior = Number(metric.prior || 0);
          const statusMetric = metric.metric || metric.key;
          const tone = statusFor(statusMetric, current, prior);
          const change = variance(current, prior);
          const direction = change.absolute > 0 ? 'up' : change.absolute < 0 ? 'down' : 'flat';
          const includePercent = ['booking', 'cashing', 'totalCost'].includes(metric.key);

          return <KpiCard key={metric.label} label={metric.label} icon={metric.icon} tone={tone} direction={direction} value={metric.key === 'ratio' ? formatPercent(metric.value) : compactMoney(metric.value, currency)} delta={deltaLabel(current, prior, metric.key, currency, includePercent)} helper={metric.helper} status={metric.key === 'cashGap' ? (metric.value >= 0 ? 'Surplus' : 'Gap') : undefined} />;
        })}
      </section>

      <div className="dashboard-grid wide-left">
        <section className="panel"><div className="panel-heading"><div><h2>Period Performance Comparison</h2><p>{snapshot.periodLabel} totals across revenue, cash and cost categories.</p></div><StatusBadge>{filters.baselineYear} vs {filters.comparisonYear}</StatusBadge></div><PeriodComparison snapshot={snapshot} filters={filters} currency={currency} /></section>
        <section className="panel"><div className="panel-heading"><div><h2>Executive Signals</h2><p>Automatically generated signals from the selected reporting period.</p></div></div><Insights items={insights.slice(0, 4)} /></section>
      </div>

      <section id="monthly-performance" className="panel"><div className="panel-heading"><div><h2>Monthly Performance</h2><p>Full-year context with selected-period months emphasized. Missing future months remain blank.</p></div><select className="inline-select" value={filters.metricFocus} onChange={(event) => setFilters((current) => ({ ...current, metricFocus: event.target.value }))}><option value="commercial">Booking & Cashing</option><option value="booking">Booking</option><option value="cashing">Cashing</option><option value="totalCost">Total Cost</option><option value="cashCoverage">Cash Coverage</option><option value="bookingToCash">Booking-to-Cash</option></select></div><MonthlyPerformance rows={monthlyRows} filters={filters} currency={currency} /></section>

      <div id="cost-structure" className="dashboard-grid three-column">
        <section className="panel"><div className="panel-heading"><div><h2>Cost Structure</h2><p>{filters.comparisonYear} selected-period cost mix.</p></div></div><CostDonut snapshot={snapshot} currency={currency} /></section>
        <section className="panel"><div className="panel-heading"><div><h2>Cost Component Comparison</h2><p>Baseline and comparison-year cost components.</p></div></div><CostComparison snapshot={snapshot} filters={filters} currency={currency} /></section>
        <section className="panel"><div className="panel-heading"><div><h2>Coverage & Conversion</h2><p>Cash efficiency against costs and booked revenue.</p></div></div><CoveragePanel snapshot={snapshot} filters={filters} /></section>
      </div>

      <section id="monthly-matrix" className="panel"><div className="panel-heading"><div><h2>Monthly Comparison Matrix</h2><p>Detailed month-by-month position. Faded rows are full-year context outside the selected period.</p></div></div><MonthlyMatrix rows={monthlyRows} filters={filters} currency={currency} /></section>
      <section className="panel insights-panel"><div className="panel-heading"><div><h2>Management Insights</h2><p>A concise readout for leadership review and follow-up.</p></div></div><Insights items={insights} /></section>
    </>
  );
}
