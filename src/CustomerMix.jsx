import { MONTHS, variance } from './dashboard';
import { validateCustomerMix } from './customerMix';
import { fullMoney, formatPercent, shortTimestamp, StatusBadge } from './ui';

export function CustomerMix({ summary, currency }) {
  let parsed;
  let error;
  try { if (summary) parsed = validateCustomerMix(summary); } catch (issue) { error = issue.message; }
  const stale = parsed && Date.now() - Date.parse(parsed.updatedAt) > 3 * 60 * 60 * 1000;
  return (
    <section id="customer-mix" className="panel">
      <div className="panel-heading"><div><h2>Acquisition &amp; Retention</h2><p>Year-to-date booking amounts from Ret/Acq. Uses the source sheet periods independently of the comparison filters.</p></div><StatusBadge tone={!parsed || stale ? 'warning' : 'good'}>{!parsed ? 'Awaiting source data' : stale ? 'Update overdue' : `Updated ${shortTimestamp(parsed.updatedAt)}`}</StatusBadge></div>
      {!parsed ? <p role="status">{error ? `Source summary unavailable: ${error}` : 'The source summary will appear after the next connected data refresh.'}</p> : (
        <div className="table-shell"><table>
          <thead><tr><th>Segment</th>{parsed.columns.map((column) => <th key={column.year}>Jan–{MONTHS[column.throughMonth - 1]} {column.year}</th>)}<th>Year-over-year change</th></tr></thead>
          <tbody>{parsed.rows.map((row) => {
            const [current, prior] = row.values;
            const comparable = parsed.columns[0].throughMonth === parsed.columns[1].throughMonth;
            const change = variance(current.amount, prior.amount);
            return <tr key={row.segment}><td><strong>{row.segment}</strong></td>{row.values.map((value, index) => <td key={index}>{fullMoney(value.amount, currency)}</td>)}<td>{comparable ? formatPercent(change.percent) : 'Different periods'}</td></tr>;
          })}</tbody>
        </table></div>
      )}
    </section>
  );
}

