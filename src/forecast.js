import { getRow, MONTHS, safeDivide } from './dashboard';

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateForecast(actualData, payload) {
  if (!payload || !Array.isArray(payload.booking) || !Array.isArray(payload.cashing)) {
    throw new Error('Forecast data is missing or invalid.');
  }

  const year = number(payload.metadata?.year);
  const actualThroughIndex = number(payload.metadata?.actualThroughMonthNumber) - 1;
  const forecastStartIndex = number(payload.metadata?.forecastStartMonthNumber) - 1;
  const forecastEndIndex = number(payload.metadata?.forecastEndMonthNumber) - 1;
  const sumRows = (rows) => rows[0]?.monthly?.map((_, index) => rows.reduce((total, row) => total + number(row.monthly?.[index]), 0)) || [];
  const bookingForecast = sumRows(payload.booking);
  const cashingForecast = sumRows(payload.cashing);

  const projectedExpenses = number(
    payload.costPlan?.projectedExpenses
      ?? payload.costPlan?.annualCostExSupport
      ?? payload.costPlan?.annualCost,
  );
  const supportAllocation = number(payload.costPlan?.supportAllocation);
  const annualCost = number(
    payload.costPlan?.annualCostWithSupport
      ?? payload.costPlan?.annualCost
      ?? projectedExpenses + supportAllocation,
  );
  const monthlyExpensesExSupport = projectedExpenses / 12;
  const monthlyCost = annualCost / 12;

  const monthly = MONTHS.map((month, index) => {
    const actual = getRow(actualData, year, index);
    const isActual = index <= actualThroughIndex;
    const isForecast = index >= forecastStartIndex && index <= forecastEndIndex;
    const offset = index - forecastStartIndex;
    const booking = isActual ? actual.booking : isForecast ? number(bookingForecast[offset]) : 0;
    const cashing = isActual ? actual.cashing : isForecast ? number(cashingForecast[offset]) : 0;

    return {
      month,
      monthNumber: index + 1,
      status: isActual ? 'actual' : isForecast ? 'forecast' : 'unavailable',
      booking,
      cashing,
      cost: monthlyCost,
      costExSupport: monthlyExpensesExSupport,
      costWithSupport: monthlyCost,
      bookingActual: isActual ? booking : null,
      bookingForecast: isForecast ? booking : null,
      cashingActual: isActual ? cashing : null,
      cashingForecast: isForecast ? cashing : null,
    };
  });

  let cumulativeBooking = 0;
  let cumulativeCashing = 0;
  let cumulativeExpensesExSupport = 0;
  let cumulativeCost = 0;
  const cumulative = monthly.map((row) => {
    cumulativeBooking += row.booking;
    cumulativeCashing += row.cashing;
    cumulativeExpensesExSupport += row.costExSupport;
    cumulativeCost += row.costWithSupport;
    return {
      ...row,
      cumulativeBooking,
      cumulativeCashing,
      cumulativeExpensesExSupport,
      cumulativeCost,
    };
  });

  const actualRows = monthly.filter((row) => row.status === 'actual');
  const forecastRows = monthly.filter((row) => row.status === 'forecast');
  const actualBooking = actualRows.reduce((sum, row) => sum + row.booking, 0);
  const actualCashing = actualRows.reduce((sum, row) => sum + row.cashing, 0);
  const forecastBooking = forecastRows.reduce((sum, row) => sum + row.booking, 0);
  const forecastCashing = forecastRows.reduce((sum, row) => sum + row.cashing, 0);
  const fullYearBooking = actualBooking + forecastBooking;
  const fullYearCashing = actualCashing + forecastCashing;
  const operatingResult = fullYearBooking - annualCost;
  const cashSurplus = fullYearCashing - annualCost;

  return {
    payload,
    currency: 'USD',
    year,
    monthly,
    cumulative,
    actualBooking,
    actualCashing,
    forecastBooking,
    forecastCashing,
    fullYearBooking,
    fullYearCashing,
    projectedExpenses,
    supportAllocation,
    annualCost,
    monthlyExpensesExSupport,
    monthlyCost,
    operatingResult,
    operatingMargin: safeDivide(operatingResult, fullYearBooking),
    cashSurplus,
    cashCoverage: safeDivide(fullYearCashing, annualCost),
    bookingToCash: safeDivide(fullYearCashing, fullYearBooking),
  };
}
