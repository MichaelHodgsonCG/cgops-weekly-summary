export interface DailyLogbookData {
  locationName: string;
  reportDate: string;
  salesForecast: number | null;
  salesActual: number | null;
  varianceForecastToSales: number | null;
  scheduledLabor: number | null;
  actualLabor: number | null;
  laborCostVsSalesForecast: number | null;
  laborCostVsSalesActual: number | null;
  mtdForecast: number | null;
  mtdSales: number | null;
  varianceMtdForecastToSales: number | null;
  salesActualPreviousYear: number | null;
  actualLaborCostPreviousYear: number | null;
  weatherHigh: number | null;
  weatherLow: number | null;
  weatherConditions: string | null;
  journalEntry: string | null;
}

function parseMoneyValue(text: string): number | null {
  const match = text.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
  if (match) {
    const cleaned = match[1].replace(/,/g, '');
    return parseFloat(cleaned);
  }
  return null;
}

function parsePercentValue(text: string): number | null {
  const match = text.match(/(-?[0-9]+(?:\.[0-9]+)?)%/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function parseWeatherValue(text: string): { high: number | null; low: number | null; conditions: string | null } {
  const highMatch = text.match(/High:\s*([0-9.]+)/i);
  const lowMatch = text.match(/Low:\s*([0-9.]+)/i);

  let conditions = text.replace(/High:\s*[0-9.]+/i, '').replace(/Low:\s*[0-9.]+/i, '').trim();

  return {
    high: highMatch ? parseFloat(highMatch[1]) : null,
    low: lowMatch ? parseFloat(lowMatch[1]) : null,
    conditions: conditions || null
  };
}

export function parseDailyLogbookEmail(bodyText: string): DailyLogbookData | null {
  const locationMatch = bodyText.match(/Company:\s*(.+?)(?:\n|Date:)/i);
  const dateMatch = bodyText.match(/Date:\s*(\d{4}-\d{2}-\d{2})/i);

  if (!locationMatch || !dateMatch) {
    return null;
  }

  const locationName = locationMatch[1].trim();
  const reportDate = dateMatch[1];

  const data: DailyLogbookData = {
    locationName,
    reportDate,
    salesForecast: null,
    salesActual: null,
    varianceForecastToSales: null,
    scheduledLabor: null,
    actualLabor: null,
    laborCostVsSalesForecast: null,
    laborCostVsSalesActual: null,
    mtdForecast: null,
    mtdSales: null,
    varianceMtdForecastToSales: null,
    salesActualPreviousYear: null,
    actualLaborCostPreviousYear: null,
    weatherHigh: null,
    weatherLow: null,
    weatherConditions: null,
    journalEntry: null,
  };

  const salesForecastMatch = bodyText.match(/Sales Forecast:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (salesForecastMatch) {
    data.salesForecast = parseMoneyValue(salesForecastMatch[0]);
  }

  const salesActualMatch = bodyText.match(/Sales Actual:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (salesActualMatch) {
    data.salesActual = parseMoneyValue(salesActualMatch[0]);
  }

  const varianceForecastMatch = bodyText.match(/Variance of Forecast to Sales:\s*(-?[0-9.]+)%/i);
  if (varianceForecastMatch) {
    data.varianceForecastToSales = parsePercentValue(varianceForecastMatch[0]);
  }

  const scheduledLaborMatch = bodyText.match(/Scheduled Labor:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (scheduledLaborMatch) {
    data.scheduledLabor = parseMoneyValue(scheduledLaborMatch[0]);
  }

  const actualLaborMatch = bodyText.match(/Actual Labor:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (actualLaborMatch) {
    data.actualLabor = parseMoneyValue(actualLaborMatch[0]);
  }

  const laborCostForecastMatch = bodyText.match(/Labor Cost vs\. Sales \(Forecast\):\s*([0-9.]+)%/i);
  if (laborCostForecastMatch) {
    data.laborCostVsSalesForecast = parsePercentValue(laborCostForecastMatch[0]);
  }

  const laborCostActualMatch = bodyText.match(/Labor Cost vs\. Sales \(Actual\):\s*([0-9.]+)%/i);
  if (laborCostActualMatch) {
    data.laborCostVsSalesActual = parsePercentValue(laborCostActualMatch[0]);
  }

  const mtdForecastMatch = bodyText.match(/MTD Forecast:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (mtdForecastMatch) {
    data.mtdForecast = parseMoneyValue(mtdForecastMatch[0]);
  }

  const mtdSalesMatch = bodyText.match(/MTD Sales:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (mtdSalesMatch) {
    data.mtdSales = parseMoneyValue(mtdSalesMatch[0]);
  }

  const varianceMtdMatch = bodyText.match(/Variance of MTD Forecast to Sales:\s*(-?[0-9.]+)%/i);
  if (varianceMtdMatch) {
    data.varianceMtdForecastToSales = parsePercentValue(varianceMtdMatch[0]);
  }

  const salesPrevYearMatch = bodyText.match(/Sales Actual \(Previous Year\):\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (salesPrevYearMatch) {
    data.salesActualPreviousYear = parseMoneyValue(salesPrevYearMatch[0]);
  }

  const laborPrevYearMatch = bodyText.match(/Actual Labor Cost \(Previous Year\):\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
  if (laborPrevYearMatch) {
    data.actualLaborCostPreviousYear = parseMoneyValue(laborPrevYearMatch[0]);
  }

  const weatherMatch = bodyText.match(/Weather:\s*(.+?)(?:\n|\*)/i);
  if (weatherMatch) {
    const weather = parseWeatherValue(weatherMatch[1]);
    data.weatherHigh = weather.high;
    data.weatherLow = weather.low;
    data.weatherConditions = weather.conditions;
  }

  const journalMatch = bodyText.match(/Journal[:\s]+(.+?)(?=\n\n|\*\*|$)/is);
  if (journalMatch) {
    data.journalEntry = journalMatch[1].trim();
  }

  return data;
}
