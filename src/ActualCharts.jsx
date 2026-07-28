import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, TrendingDown } from 'lucide-react';
import { safeDivide } from './dashboard';
import { COLORS, ChartTooltip, compactMoney, formatPercent, axisMoney } from './ui';

export function PeriodComparison({ snapshot, filters, currency }) {
  const rows = [
    { name: 'Booking', baseline: snapshot.baseline.booking, comparison: snapshot.comparison.booking },
    { name: 'Cashing', baseline: snapshot.baseline.cashing, comparison: snapshot.comparison.cashing },
    { name: 'COGS', baseline: snapshot.baseline.cogs, comparison: snapshot.comparison.cogs },
    { name: 'Overheads', baseline: snapshot.baseline.overheads, comparison: snapshot.comparison.overheads },
    { name: 'Support', baseline: snapshot.baseline.support, comparison: snapshot.comparison.support },
    { name: 'Total Cost', baseline: snapshot.baseline.totalCost, comparison: snapshot.comparison.totalCost },
  ];
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ede9" />
        <XAxis dataKey="name" tick={{ fill: '#63776e', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(value) => axisMoney(value, currency)} tick={{ fill: '#819188', fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Bar dataKey="baseline" name={String(filters.baselineYear)} fill={COLORS.baseline} radius={[7, 7, 2, 2]} maxBarSize={48} />
        <Bar dataKey="comparison" name={String(filters.comparisonYear)} fill={COLORS.greenDark} radius={[7, 7, 2, 2]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyPerformance({ rows, filters, currency }) {
  const percentChart = ['cashCoverage', 'bookingToCash'].includes(filters.metricFocus);
  const dataKeys = (() => {
    if (filters.metricFocus === 'commercial') return [
      { key: 'bookingBaseline', name: `Booking ${filters.baselineYear}`, color: COLORS.baseline, dash: '5 5' },
      { key: 'cashingBaseline', name: `Cashing ${filters.baselineYear}`, color: '#ccd7e2', dash: '5 5' },
      { key: 'bookingComparison', name: `Booking ${filters.comparisonYear}`, color: COLORS.greenDark },
      { key: 'cashingComparison', name: `Cashing ${filters.comparisonYear}`, color: COLORS.green },
    ];
    const prefix = filters.metricFocus === 'booking' ? 'booking' : filters.metricFocus === 'cashing' ? 'cashing' : filters.metricFocus === 'totalCost' ? 'cost' : filters.metricFocus;
    return [
      { key: `${prefix}Baseline`, name: `${filters.baselineYear}`, color: COLORS.baseline, dash: '5 5' },
      { key: `${prefix}Comparison`, name: `${filters.comparisonYear}`, color: COLORS.green },
    ];
  })();
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={rows} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
        <defs><linearGradient id="comparisonArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.green} stopOpacity={0.18} /><stop offset="100%" stopColor={COLORS.green} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ede9" />
        <XAxis dataKey="month" tick={{ fill: '#63776e', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={percentChart ? (value) => `${Math.round(value * 100)}%` : (value) => axisMoney(value, currency)} tick={{ fill: '#819188', fontSize: 10 }} axisLine={false} tickLine={false} width={70} domain={[0, 'auto']} />
        <Tooltip content={<ChartTooltip currency={currency} percent={percentChart} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        {dataKeys.map((line, index) => index === dataKeys.length - 1 && dataKeys.length === 2 ? (
          <Area key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} fill="url(#comparisonArea)" strokeWidth={3} connectNulls dot={{ r: 3, fill: line.color }} />
        ) : (
          <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={index >= Math.max(1, dataKeys.length - 2) ? 3 : 2} strokeDasharray={line.dash} connectNulls dot={{ r: 2.5, fill: line.color }} activeDot={{ r: 5 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CostDonut({ snapshot, currency }) {
  const data = [
    { name: 'COGS', value: snapshot.comparison.cogs, color: COLORS.red },
    { name: 'Overheads', value: snapshot.comparison.overheads, color: COLORS.purple },
    { name: 'Support', value: snapshot.comparison.support, color: COLORS.amber },
  ];
  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height={245}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={96} paddingAngle={3} stroke="#fff" strokeWidth={3}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltip currency={currency} />} /></PieChart></ResponsiveContainer>
        <div className="donut-center"><strong>{compactMoney(snapshot.comparison.totalCost, currency)}</strong><span>Total cost</span></div>
      </div>
      <div className="legend-stack">{data.map((entry) => <div key={entry.name}><i style={{ background: entry.color }} /><span>{entry.name}</span><b>{compactMoney(entry.value, currency)}</b><small>{formatPercent(safeDivide(entry.value, snapshot.comparison.totalCost))}</small></div>)}</div>
    </div>
  );
}

export function CostComparison({ snapshot, filters, currency }) {
  const data = [
    { name: 'COGS', baseline: snapshot.baseline.cogs, comparison: snapshot.comparison.cogs },
    { name: 'Overheads', baseline: snapshot.baseline.overheads, comparison: snapshot.comparison.overheads },
    { name: 'Support', baseline: snapshot.baseline.support, comparison: snapshot.comparison.support },
  ];
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6ede9" />
        <XAxis type="number" tickFormatter={(value) => axisMoney(value, currency)} tick={{ fill: '#819188', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={75} tick={{ fill: '#42584e', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip currency={currency} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="baseline" name={String(filters.baselineYear)} fill={COLORS.baseline} radius={[0, 6, 6, 0]} maxBarSize={22} />
        <Bar dataKey="comparison" name={String(filters.comparisonYear)} fill={COLORS.green} radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CoveragePanel({ snapshot, filters }) {
  const rows = [
    { label: 'Cash coverage', value: snapshot.comparison.cashCoverage, baseline: snapshot.baseline.cashCoverage, target: 1, color: COLORS.green },
    { label: 'Booking-to-cash', value: snapshot.comparison.bookingToCash, baseline: snapshot.baseline.bookingToCash, target: 1, color: COLORS.blue },
  ];
  return (
    <div className="coverage-list">
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, (row.value || 0) * 100));
        return <div className="coverage-item" key={row.label}><div className="coverage-title"><span>{row.label}</span><strong>{formatPercent(row.value)}</strong></div><div className="progress-track"><i style={{ width: `${width}%`, background: row.color }} /></div><div className="coverage-meta"><span>{filters.baselineYear}: {formatPercent(row.baseline)}</span><b>{row.value >= row.target ? 'Target covered' : `${((row.target - (row.value || 0)) * 100).toFixed(1)} pts to 100%`}</b></div></div>;
      })}
      <div className={`coverage-callout ${snapshot.comparison.cashGap >= 0 ? 'positive' : 'negative'}`}>
        {snapshot.comparison.cashGap >= 0 ? <CheckCircle2 size={20} /> : <TrendingDown size={20} />}
        <div><strong>{snapshot.comparison.cashGap >= 0 ? 'Positive cash position' : 'Cash gap requires attention'}</strong><span>Cashing less total cost for the selected period.</span></div>
      </div>
    </div>
  );
}
