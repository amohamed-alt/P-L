import { useState } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeDollarSign, CalendarRange, ChartNoAxesCombined, CircleDollarSign, Coins, WalletCards } from 'lucide-react';
import { MONTHS } from './dashboard';
import { COLORS, ChartTooltip, KpiCard, Section, StatusBadge, compactMoney, formatPercent, fullMoney, axisMoney } from './ui';

export function ForecastDashboard({ forecast }) {
  const [metric, setMetric] = useState('booking');
  const currency = forecast.currency;
  const cards = [
    { label: 'Full-Year Booking', value: forecast.fullYearBooking, helper: `${fullMoney(forecast.actualBooking, currency)} actual + ${fullMoney(forecast.forecastBooking, currency)} forecast`, icon: BadgeDollarSign, tone: 'positive' },
    { label: 'Full-Year Cashing', value: forecast.fullYearCashing, helper: `${formatPercent(forecast.bookingToCash)} booking-to-cash`, icon: WalletCards, tone: 'positive' },
    { label: 'Annual Cost Plan', value: forecast.annualCost, helper: `${fullMoney(forecast.monthlyCost, currency)} monthly average`, icon: Coins, tone: 'neutral' },
    { label: 'Operating Result', value: forecast.operatingResult, helper: `${formatPercent(forecast.operatingMargin)} operating margin`, icon: ChartNoAxesCombined, tone: forecast.operatingResult >= 0 ? 'positive' : 'negative' },
    { label: 'Cash Surplus', value: forecast.cashSurplus, helper: `${formatPercent(forecast.cashCoverage)} cash coverage`, icon: CircleDollarSign, tone: forecast.cashSurplus >= 0 ? 'positive' : 'negative' },
    { label: 'Monthly Cost', value: forecast.monthlyCost, helper: 'Approved annual cost ÷ 12', icon: CalendarRange, tone: 'neutral' },
  ];
  const forecastMonths = MONTHS.slice(Number(forecast.payload.metadata.forecastStartMonthNumber) - 1, Number(forecast.payload.metadata.forecastEndMonthNumber));
  const ownerRows = forecast.payload[metric] || [];
  const expected = forecast.payload.expectedTotals || {};
  const reconciled = Math.round(metric === 'booking' ? forecast.forecastBooking : forecast.forecastCashing) === Math.round(Number(metric === 'booking' ? expected.forecastBooking : expected.forecastCashing));

  return (
    <>
      <div className="forecast-hero">
        <div><span className="eyebrow">FULL-YEAR OUTLOOK</span><h1>{forecast.year} Forecast Command Center</h1><p>{forecast.payload.metadata.basis}. {forecast.payload.metadata.note}</p><div className="forecast-tags"><StatusBadge>Actual through {forecast.payload.metadata.actualThroughMonth}</StatusBadge><StatusBadge tone="info">Forecast {forecast.payload.metadata.forecastStartMonth}–{forecast.payload.metadata.forecastEndMonth}</StatusBadge><StatusBadge tone={reconciled ? 'good' : 'warning'}>{reconciled ? 'Forecast reconciled' : 'Review reconciliation'}</StatusBadge></div></div>
        <div className="forecast-orbit"><i /><strong>{formatPercent(forecast.cashCoverage)}</strong><span>Projected cash coverage</span></div>
      </div>

      <section className="kpi-grid">{cards.map((card) => <KpiCard key={card.label} label={card.label} icon={card.icon} tone={card.tone} value={fullMoney(card.value, currency)} delta={card.tone === 'positive' ? 'On track' : card.tone === 'negative' ? 'Attention' : 'Plan'} helper={card.helper} />)}</section>

      <div className="dashboard-grid two-column">
        <Section title="Monthly Actual + Forecast" description="Solid bars show actual months; lighter bars show the supplied forecast. The line is the approved monthly cost plan.">
          <ResponsiveContainer width="100%" height={360}><ComposedChart data={forecast.monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ede9" /><XAxis dataKey="month" tick={{ fill: '#63776e', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => axisMoney(value, currency)} tick={{ fill: '#819188', fontSize: 10 }} axisLine={false} tickLine={false} width={70} /><Tooltip content={<ChartTooltip currency={currency} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 12 }} /><Bar dataKey="bookingActual" name="Booking actual" fill={COLORS.greenDark} radius={[6, 6, 1, 1]} maxBarSize={24} /><Bar dataKey="bookingForecast" name="Booking forecast" fill="#86b89f" radius={[6, 6, 1, 1]} maxBarSize={24} /><Bar dataKey="cashingActual" name="Cashing actual" fill={COLORS.blue} radius={[6, 6, 1, 1]} maxBarSize={24} /><Bar dataKey="cashingForecast" name="Cashing forecast" fill="#a9c7ef" radius={[6, 6, 1, 1]} maxBarSize={24} /><Line type="monotone" dataKey="cost" name="Monthly cost" stroke={COLORS.purple} strokeWidth={2.5} strokeDasharray="6 5" dot={false} /></ComposedChart></ResponsiveContainer>
        </Section>
        <Section title="Cumulative Closing Position" description="How booking and cashing build against the cumulative annual cost plan.">
          <ResponsiveContainer width="100%" height={360}><AreaChart data={forecast.cumulative} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS.blue} stopOpacity={0.22} /><stop offset="1" stopColor={COLORS.blue} stopOpacity={0} /></linearGradient><linearGradient id="bookingArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS.green} stopOpacity={0.18} /><stop offset="1" stopColor={COLORS.green} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ede9" /><XAxis dataKey="month" tick={{ fill: '#63776e', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => axisMoney(value, currency)} tick={{ fill: '#819188', fontSize: 10 }} axisLine={false} tickLine={false} width={70} /><Tooltip content={<ChartTooltip currency={currency} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 12 }} /><Area type="monotone" dataKey="cumulativeBooking" name="Cumulative booking" stroke={COLORS.green} fill="url(#bookingArea)" strokeWidth={3} /><Area type="monotone" dataKey="cumulativeCashing" name="Cumulative cashing" stroke={COLORS.blue} fill="url(#cashArea)" strokeWidth={3} /><Line type="monotone" dataKey="cumulativeCost" name="Cumulative cost" stroke={COLORS.purple} strokeWidth={2.5} strokeDasharray="6 5" dot={false} /></AreaChart></ResponsiveContainer>
        </Section>
      </div>

      <Section title={`${metric === 'booking' ? 'Booking' : 'Cashing'} Forecast by Owner`} description={`${forecast.payload.metadata.forecastStartMonth}–${forecast.payload.metadata.forecastEndMonth} supplied forecast values.`} action={<select className="inline-select" value={metric} onChange={(event) => setMetric(event.target.value)}><option value="booking">Booking forecast</option><option value="cashing">Cashing forecast</option></select>}>
        <div className="table-shell forecast-table"><table><thead><tr><th>Owner</th>{forecastMonths.map((month) => <th key={month}>{month}</th>)}<th>Total</th></tr></thead><tbody>{ownerRows.map((row) => <tr key={row.owner}><td><strong>{row.owner}</strong></td>{row.monthly.map((value, index) => <td key={`${row.owner}-${index}`}>{fullMoney(value, currency)}</td>)}<td><strong>{fullMoney(row.monthly.reduce((sum, value) => sum + Number(value || 0), 0), currency)}</strong></td></tr>)}</tbody></table></div>
      </Section>

      <div className="dashboard-grid three-column forecast-position-grid"><article className="position-card"><span>Projected booking position</span><strong>{fullMoney(forecast.operatingResult, currency)}</strong><small>Booking less annual cost</small></article><article className="position-card"><span>Projected cash position</span><strong>{fullMoney(forecast.cashSurplus, currency)}</strong><small>Cashing less annual cost</small></article><article className="position-card"><span>Conversion efficiency</span><strong>{formatPercent(forecast.bookingToCash)}</strong><small>Full-year cashing ÷ booking</small></article></div>
    </>
  );
}
