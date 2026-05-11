import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, AlertCircle, Calendar, MapPin, Activity } from 'lucide-react';
import { supabase, Location, PLLineItem } from '../lib/supabase';
import { useCurrentFiscalPeriod } from '../lib/useFiscalCalendar';
import { useLocationFilter } from '../lib/useLocationFilter';

type PortfolioMetrics = {
  totalFoodSales: number;
  totalFoodSalesBudget: number;
  totalFoodCost: number;
  totalFoodCostBudget: number;
  totalLabour: number;
  totalLabourBudget: number;
  totalEbitdaVar: number;
  locationsAboveBudget: number;
  locationsBelowBudget: number;
  totalLocations: number;
  ytdFoodSales: number;
  ytdFoodSalesBudget: number;
  ytdFoodCost: number;
  ytdFoodCostBudget: number;
  ytdLabour: number;
  ytdLabourBudget: number;
  ytdEbitda: number;
  ytdEbitdaBudget: number;
};

type WTDMetrics = {
  wtdSales: number;
  wtdSalesVsProjections: number;
  bohLabourActualPct: number;
  bohLabourBudgetPct: number;
  bohLabourDollarsVsSales: number;
  substandardDollars: number;
  substandardPct: number;
  slpDate: string;
} | null;

type RegionalMetrics = {
  region: string;
  foodSales: number;
  avgFoodCostPct: number;
  avgLabourPct: number;
  ebitdaVar: number;
  locationCount: number;
};

type PortfolioViewProps = {
  weekEndingDate: string;
};

export default function PortfolioView({ weekEndingDate }: PortfolioViewProps) {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [regionalMetrics, setRegionalMetrics] = useState<RegionalMetrics[]>([]);
  const [wtdMetrics, setWtdMetrics] = useState<WTDMetrics>(null);
  const [loading, setLoading] = useState(true);
  const { currentPeriod } = useCurrentFiscalPeriod();
  const locationFilter = useLocationFilter('portfolio');

  useEffect(() => {
    loadPortfolioData();
    loadWTDMetrics();
  }, [weekEndingDate, locationFilter.isFiltered, locationFilter.preferredLocations]);

  const loadWTDMetrics = async () => {
    const { data: latestReport } = await supabase
      .from('slp_reports')
      .select('id, report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestReport) return;

    const [{ data: salesData }, { data: labourData }, { data: promoData }] = await Promise.all([
      supabase
        .from('slp_sales_data')
        .select('total_wtd_sales, wtd_sales_vs_projections')
        .eq('report_id', latestReport.id)
        .eq('location_name', '__TOTAL__')
        .maybeSingle(),
      supabase
        .from('slp_labor_data')
        .select('wtd_labour_actual_pct, labour_budget_pct, wtd_labour_dollars_vs_sales')
        .eq('report_id', latestReport.id)
        .eq('location_name', '__TOTAL__')
        .eq('department', 'BOH')
        .maybeSingle(),
      supabase
        .from('slp_promo_data')
        .select('substandard_dollars, total_promo_pct')
        .eq('report_id', latestReport.id)
        .eq('location_name', '__TOTAL__')
        .maybeSingle(),
    ]);

    if (!salesData || !labourData || !promoData) return;

    setWtdMetrics({
      wtdSales: Number(salesData.total_wtd_sales) || 0,
      wtdSalesVsProjections: Number(salesData.wtd_sales_vs_projections) || 0,
      bohLabourActualPct: Number(labourData.wtd_labour_actual_pct) || 0,
      bohLabourBudgetPct: Number(labourData.labour_budget_pct) || 0,
      bohLabourDollarsVsSales: Number(labourData.wtd_labour_dollars_vs_sales) || 0,
      substandardDollars: Number(promoData.substandard_dollars) || 0,
      substandardPct: Number(promoData.total_promo_pct) || 0,
      slpDate: latestReport.report_date,
    });
  };

  const loadPortfolioData = async () => {
    setLoading(true);

    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('exclude_from_reporting', false);

    if (locError || !locations) {
      setLoading(false);
      return;
    }

    const filteredLocations = locationFilter.isFiltered && locationFilter.hasPreferences
      ? locations.filter((l: Location) => locationFilter.preferredLocations.includes(l.name))
      : locations;

    const { data: lineItems, error: itemsError } = await supabase
      .from('pl_line_items')
      .select('*')
      .eq('week_ending_date', weekEndingDate);

    if (itemsError || !lineItems) {
      setLoading(false);
      return;
    }

    let totalFoodSales = 0;
    let totalFoodSalesBudget = 0;
    let totalFoodCost = 0;
    let totalFoodCostBudget = 0;
    let totalLabour = 0;
    let totalLabourBudget = 0;
    let totalEbitdaVar = 0;
    let locationsAboveBudget = 0;
    let locationsBelowBudget = 0;
    let locationsWithData = 0;

    let ytdFoodSales = 0;
    let ytdFoodSalesBudget = 0;
    let ytdFoodCost = 0;
    let ytdFoodCostBudget = 0;
    let ytdLabour = 0;
    let ytdLabourBudget = 0;
    let ytdEbitda = 0;
    let ytdEbitdaBudget = 0;

    const regionMap = new Map<string, {
      foodSales: number;
      foodCostSum: number;
      laborSum: number;
      ebitdaVar: number;
      count: number;
    }>();

    filteredLocations.forEach((location: Location) => {
      const items = lineItems.filter(item => item.location_id === location.id);
      if (items.length === 0) return;

      const foodSales = items.find(i => i.line_item_name === 'Food Sales');
      const foodCost = items.find(i => i.line_item_name === 'Cost of Sales (Food)');
      const labor = items.find(i => i.line_item_name === 'Kitchen Labour' || i.line_item_name === 'Labour');
      const ebitda = items.find(i => i.line_item_name === 'EBITDA');

      if (foodSales?.current_actual) {
        totalFoodSales += foodSales.current_actual;
      }

      if (foodSales?.current_budget) {
        totalFoodSalesBudget += foodSales.current_budget;
      }

      if (foodCost?.current_actual_pct !== null && foodCost?.current_actual_pct !== undefined && foodSales?.current_actual) {
        totalFoodCost += (foodCost.current_actual_pct / 100) * foodSales.current_actual;
      }

      if (foodCost?.current_budget_pct !== null && foodCost?.current_budget_pct !== undefined && foodSales?.current_actual) {
        totalFoodCostBudget += (foodCost.current_budget_pct / 100) * foodSales.current_actual;
      }

      if (labor?.current_actual_pct !== null && labor?.current_actual_pct !== undefined && foodSales?.current_actual) {
        totalLabour += (labor.current_actual_pct / 100) * foodSales.current_actual;
      }

      if (labor?.current_budget_pct !== null && labor?.current_budget_pct !== undefined && foodSales?.current_actual) {
        totalLabourBudget += (labor.current_budget_pct / 100) * foodSales.current_actual;
      }

      if (foodSales?.ytd_actual) {
        ytdFoodSales += foodSales.ytd_actual;
      }

      if (foodSales?.ytd_budget) {
        ytdFoodSalesBudget += foodSales.ytd_budget;
      }

      if (foodCost?.ytd_actual_pct !== null && foodCost?.ytd_actual_pct !== undefined && foodSales?.ytd_actual) {
        ytdFoodCost += (foodCost.ytd_actual_pct / 100) * foodSales.ytd_actual;
      }

      if (foodCost?.ytd_budget_pct !== null && foodCost?.ytd_budget_pct !== undefined && foodSales?.ytd_actual) {
        ytdFoodCostBudget += (foodCost.ytd_budget_pct / 100) * foodSales.ytd_actual;
      }

      if (labor?.ytd_actual_pct !== null && labor?.ytd_actual_pct !== undefined && foodSales?.ytd_actual) {
        ytdLabour += (labor.ytd_actual_pct / 100) * foodSales.ytd_actual;
      }

      if (labor?.ytd_budget_pct !== null && labor?.ytd_budget_pct !== undefined && foodSales?.ytd_actual) {
        ytdLabourBudget += (labor.ytd_budget_pct / 100) * foodSales.ytd_actual;
      }

      if (ebitda?.ytd_actual) {
        ytdEbitda += ebitda.ytd_actual;
      }

      if (ebitda?.ytd_budget) {
        ytdEbitdaBudget += ebitda.ytd_budget;
      }

      if (ebitda?.current_actual !== null && ebitda?.current_budget !== null) {
        const variance = ebitda.current_actual - ebitda.current_budget;
        totalEbitdaVar += variance;

        if (variance >= 0) {
          locationsAboveBudget++;
        } else {
          locationsBelowBudget++;
        }
      }

      locationsWithData++;

      const region = location.region || 'Unknown';
      const regionData = regionMap.get(region) || {
        foodSales: 0,
        foodCostSum: 0,
        laborSum: 0,
        ebitdaVar: 0,
        count: 0
      };

      if (foodSales?.current_actual) {
        regionData.foodSales += foodSales.current_actual;
      }
      if (foodCost?.current_actual_pct !== null && foodCost?.current_actual_pct !== undefined) {
        regionData.foodCostSum += foodCost.current_actual_pct;
      }
      if (labor?.current_actual_pct !== null && labor?.current_actual_pct !== undefined) {
        regionData.laborSum += labor.current_actual_pct;
      }
      if (ebitda?.current_actual !== null && ebitda?.current_budget !== null) {
        regionData.ebitdaVar += (ebitda.current_actual - ebitda.current_budget);
      }
      regionData.count++;

      regionMap.set(region, regionData);
    });

    setMetrics({
      totalFoodSales,
      totalFoodSalesBudget,
      totalFoodCost,
      totalFoodCostBudget,
      totalLabour,
      totalLabourBudget,
      totalEbitdaVar,
      locationsAboveBudget,
      locationsBelowBudget,
      totalLocations: filteredLocations.length,
      ytdFoodSales,
      ytdFoodSalesBudget,
      ytdFoodCost,
      ytdFoodCostBudget,
      ytdLabour,
      ytdLabourBudget,
      ytdEbitda,
      ytdEbitdaBudget
    });

    const regional: RegionalMetrics[] = Array.from(regionMap.entries()).map(([region, data]) => ({
      region,
      foodSales: data.foodSales,
      avgFoodCostPct: data.count > 0 ? data.foodCostSum / data.count : 0,
      avgLabourPct: data.count > 0 ? data.laborSum / data.count : 0,
      ebitdaVar: data.ebitdaVar,
      locationCount: data.count
    }));

    setRegionalMetrics(regional);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading portfolio data...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-600">No portfolio data available</p>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const dateDisplay = currentPeriod
    ? `${currentDate}   Period ${currentPeriod.period} Week ${currentPeriod.week}`
    : currentDate;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg shadow-sm p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 opacity-75" />
            <div className="text-sm font-semibold">
              {dateDisplay}
            </div>
          </div>
          {locationFilter.hasPreferences && (
            <button
              onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                locationFilter.isFiltered
                  ? 'bg-white text-slate-800 border-white'
                  : 'bg-transparent text-white border-white/50 hover:border-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
            </button>
          )}
        </div>
      </div>

      {wtdMetrics && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Week to Date (WTD)</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              SLP {new Date(wtdMetrics.slpDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-500">WTD Food Sales</div>
                <DollarSign className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-1">
                {formatCurrency(wtdMetrics.wtdSales)}
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${wtdMetrics.wtdSalesVsProjections >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {wtdMetrics.wtdSalesVsProjections >= 0
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />}
                <span>{wtdMetrics.wtdSalesVsProjections >= 0 ? '+' : ''}{formatCurrency(wtdMetrics.wtdSalesVsProjections)} vs projected</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-500">WTD BOH Labour</div>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className={`text-2xl font-bold ${wtdMetrics.bohLabourActualPct > wtdMetrics.bohLabourBudgetPct ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPercent(wtdMetrics.bohLabourActualPct)}
                </div>
                <div className="text-sm text-slate-400">vs {formatPercent(wtdMetrics.bohLabourBudgetPct)} budget</div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${wtdMetrics.bohLabourDollarsVsSales <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {wtdMetrics.bohLabourDollarsVsSales <= 0
                  ? <TrendingDown className="w-3 h-3" />
                  : <TrendingUp className="w-3 h-3" />}
                <span>
                  {wtdMetrics.bohLabourDollarsVsSales >= 0 ? '+' : ''}{formatCurrency(wtdMetrics.bohLabourDollarsVsSales)} $ variance
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-500">WTD Substandard Promos</div>
                <Percent className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className={`text-2xl font-bold ${wtdMetrics.substandardPct > 0.5 ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatCurrency(wtdMetrics.substandardDollars)}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatPercent(wtdMetrics.substandardPct)} of sales
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Period to Date (PTD)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-sm p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium opacity-90">PTD Food Sales</div>
              <DollarSign className="w-5 h-5 opacity-75" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(metrics.totalFoodSales)}</div>
            <div className="text-xs opacity-75">
              Budget: {formatCurrency(metrics.totalFoodSalesBudget)}
            </div>
            <div className="text-xs mt-1 font-semibold">
              {metrics.totalFoodSales - metrics.totalFoodSalesBudget >= 0 ? '+' : ''}
              {formatCurrency(metrics.totalFoodSales - metrics.totalFoodSalesBudget)}
            </div>
          </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-600">PTD Food Cost</div>
            <Percent className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {formatPercent((metrics.totalFoodCost / metrics.totalFoodSales) * 100)}
          </div>
          <div className="text-xs text-slate-500">
            Budget: {formatPercent((metrics.totalFoodCostBudget / metrics.totalFoodSales) * 100)} |
            {metrics.totalFoodCost - metrics.totalFoodCostBudget >= 0 ? ' +' : ' '}
            {formatCurrency(metrics.totalFoodCost - metrics.totalFoodCostBudget)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-600">PTD Labour</div>
            <Percent className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {formatPercent((metrics.totalLabour / metrics.totalFoodSales) * 100)}
          </div>
          <div className="text-xs text-slate-500">
            Budget: {formatPercent((metrics.totalLabourBudget / metrics.totalFoodSales) * 100)} |
            {metrics.totalLabour - metrics.totalLabourBudget >= 0 ? ' +' : ' '}
            {formatCurrency(metrics.totalLabour - metrics.totalLabourBudget)}
          </div>
        </div>

        <div className={`rounded-lg shadow-sm p-6 ${metrics.totalEbitdaVar >= 0 ? 'bg-gradient-to-br from-green-600 to-green-500' : 'bg-gradient-to-br from-red-600 to-red-500'} text-white`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium opacity-90">PTD EBITDA vs Budget</div>
            <Target className="w-5 h-5 opacity-75" />
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(metrics.totalEbitdaVar)}</div>
          <div className="text-xs opacity-75">
            {metrics.totalEbitdaVar >= 0 ? 'Above' : 'Below'} budget
          </div>
        </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Year to Date (YTD)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border-2 border-slate-300 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-600">YTD Food Sales</div>
              <DollarSign className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(metrics.ytdFoodSales)}</div>
            <div className="text-xs text-slate-500">
              Budget: {formatCurrency(metrics.ytdFoodSalesBudget)}
            </div>
            <div className={`text-xs mt-1 font-semibold ${metrics.ytdFoodSales - metrics.ytdFoodSalesBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.ytdFoodSales - metrics.ytdFoodSalesBudget >= 0 ? '+' : ''}
              {formatCurrency(metrics.ytdFoodSales - metrics.ytdFoodSalesBudget)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border-2 border-slate-300 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-600">YTD Food Cost</div>
              <Percent className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {formatPercent((metrics.ytdFoodCost / metrics.ytdFoodSales) * 100)}
            </div>
            <div className="text-xs text-slate-500">
              Budget: {formatPercent((metrics.ytdFoodCostBudget / metrics.ytdFoodSales) * 100)}
            </div>
            <div className={`text-xs mt-1 font-semibold ${metrics.ytdFoodCost - metrics.ytdFoodCostBudget >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.ytdFoodCost - metrics.ytdFoodCostBudget >= 0 ? '+' : ''}
              {formatCurrency(metrics.ytdFoodCost - metrics.ytdFoodCostBudget)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border-2 border-slate-300 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-600">YTD Labour</div>
              <Percent className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {formatPercent((metrics.ytdLabour / metrics.ytdFoodSales) * 100)}
            </div>
            <div className="text-xs text-slate-500">
              Budget: {formatPercent((metrics.ytdLabourBudget / metrics.ytdFoodSales) * 100)}
            </div>
            <div className={`text-xs mt-1 font-semibold ${metrics.ytdLabour - metrics.ytdLabourBudget >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.ytdLabour - metrics.ytdLabourBudget >= 0 ? '+' : ''}
              {formatCurrency(metrics.ytdLabour - metrics.ytdLabourBudget)}
            </div>
          </div>

          <div className={`rounded-lg shadow-sm border-2 p-6 ${metrics.ytdEbitda - metrics.ytdEbitdaBudget >= 0 ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-600">YTD EBITDA</div>
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <div className={`text-3xl font-bold mb-1 ${metrics.ytdEbitda - metrics.ytdEbitdaBudget >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(metrics.ytdEbitda)}
            </div>
            <div className="text-xs text-slate-500">
              Budget: {formatCurrency(metrics.ytdEbitdaBudget)}
            </div>
            <div className={`text-xs mt-1 font-semibold ${metrics.ytdEbitda - metrics.ytdEbitdaBudget >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {metrics.ytdEbitda - metrics.ytdEbitdaBudget >= 0 ? '+' : ''}
              {formatCurrency(metrics.ytdEbitda - metrics.ytdEbitdaBudget)} vs budget
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Budget Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600">Above Budget</div>
                  <div className="text-2xl font-bold text-slate-800">{metrics.locationsAboveBudget}</div>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                {metrics.totalLocations > 0 ? ((metrics.locationsAboveBudget / metrics.totalLocations) * 100).toFixed(0) : 0}%
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600">Below Budget</div>
                  <div className="text-2xl font-bold text-slate-800">{metrics.locationsBelowBudget}</div>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                {metrics.totalLocations > 0 ? ((metrics.locationsBelowBudget / metrics.totalLocations) * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Regional Performance</h3>
          <div className="space-y-3">
            {regionalMetrics.map(region => (
              <div key={region.region} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-800">{region.region} Region</h4>
                  <span className="text-xs text-slate-500">{region.locationCount} locations</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Sales</div>
                    <div className="font-semibold text-slate-800">{formatCurrency(region.foodSales)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">EBITDA Var</div>
                    <div className={`font-semibold ${region.ebitdaVar >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(region.ebitdaVar)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Food Cost</div>
                    <div className="font-semibold text-slate-800">{formatPercent(region.avgFoodCostPct)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Labour</div>
                    <div className="font-semibold text-slate-800">{formatPercent(region.avgLabourPct)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Key Insights</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>
                  Portfolio is {metrics.totalEbitdaVar >= 0 ? 'exceeding' : 'below'} budget by {formatCurrency(Math.abs(metrics.totalEbitdaVar))} this week
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>
                  {((metrics.locationsAboveBudget / metrics.totalLocations) * 100).toFixed(0)}% of locations are meeting or exceeding EBITDA targets
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>
                  Food cost is {formatPercent((metrics.totalFoodCost / metrics.totalFoodSales) * 100)} vs budget of {formatPercent((metrics.totalFoodCostBudget / metrics.totalFoodSales) * 100)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
