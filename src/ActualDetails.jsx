import { AlertTriangle, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { variance } from './dashboard';
import { StatusBadge, formatPercent, fullMoney } from './ui';

export function MonthlyMatrix({ rows, filters, currency }) {
  return (
    <div className="table-shell">
      <table>
        <thead><tr><th>Month</th><th>{filters.baselineYear} Booking</th><th>{filters.comparisonYear} Booking</th><th>Booking YoY</th><th>{filters.baselineYear} Cashing</th><th>{filters.comparisonYear} Cashing</th><th>Cash YoY</th><th>{filters.comparisonYear} Cost</th><th>Cash Coverage</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const bookingChange = variance(row.comparison.booking, row.baseline.booking);
            const cashChange = variance(row.comparison.cashing, row.baseline.cashing);
            return (
              <tr key={row.month} className={!row.selected ? 'context-row' : row.comparison.isPartial ? 'partial-row' : ''}>
                <td><strong>{row.month}</strong>{row.comparison.isPartial && <StatusBadge tone="warning">Partial</StatusBadge>}</td>
                <td>{row.baseline.hasMeaningfulData ? fullMoney(row.baseline.booking, currency) : '—'}</td>
                <td>{row.comparison.hasMeaningfulData ? fullMoney(row.comparison.booking, currency) : '—'}</td>
                <td><span className={`table-change ${bookingChange.percent >= 0 ? 'up' : 'down'}`}>{bookingChange.percent === null ? '—' : formatPercent(bookingChange.percent)}</span></td>
                <td>{row.baseline.hasMeaningfulData ? fullMoney(row.baseline.cashing, currency) : '—'}</td>
                <td>{row.comparison.hasMeaningfulData ? fullMoney(row.comparison.cashing, currency) : '—'}</td>
                <td><span className={`table-change ${cashChange.percent >= 0 ? 'up' : 'down'}`}>{cashChange.percent === null ? '—' : formatPercent(cashChange.percent)}</span></td>
                <td>{row.comparison.hasMeaningfulData ? fullMoney(row.comparison.totalCost, currency) : '—'}</td>
                <td>{row.comparison.hasMeaningfulData ? formatPercent(row.comparison.cashCoverage) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Insights({ items }) {
  const icon = { positive: TrendingUp, negative: TrendingDown, warning: AlertTriangle };
  return (
    <div className="insight-grid">
      {items.map((item, index) => {
        const Icon = icon[item.tone] || Sparkles;
        return <article className={`insight-card ${item.tone}`} key={`${item.title}-${index}`}><div><Icon size={18} /></div><section><strong>{item.title}</strong><p>{item.detail}</p></section></article>;
      })}
    </div>
  );
}
