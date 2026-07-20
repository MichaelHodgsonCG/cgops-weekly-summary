import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { supabase, Location, PLLineItem } from '../lib/supabase';

type LocationDetailProps = {
  locationId: string;
  weekEndingDate: string;
  onBack: () => void;
};

export default function LocationDetail({ locationId, weekEndingDate: initialWeekEndingDate, onBack }: LocationDetailProps) {
  const [location, setLocation] = useState<Location | null>(null);
  const [lineItems, setLineItems] = useState<PLLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(initialWeekEndingDate);

  useEffect(() => {
    loadAvailableWeeks();
  }, [locationId]);

  useEffect(() => {
    if (selectedWeek) {
      loadLocationDetail();
    }
  }, [locationId, selectedWeek]);

  const loadAvailableWeeks = async () => {
    const { data: locData } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();
    if (locData) setLocation(locData);

    const { data: uploads } = await supabase
      .from('weekly_summary_pl_uploads')
      .select('week_ending_date')
      .eq('location_id', locationId)
      .order('week_ending_date', { ascending: false });

    if (uploads && uploads.length > 0) {
      const weeks = uploads.map(u => u.week_ending_date);
      setAvailableWeeks(weeks);
      setSelectedWeek(weeks[0]);
    }
  };

  const loadLocationDetail = async () => {
    setLoading(true);

    const { data: itemsData } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('*')
      .eq('location_id', locationId)
      .eq('week_ending_date', selectedWeek);

    if (itemsData) {
      const orderedItems = [
        'Food Sales',
        'Total Sales',
        'Cost of Sales (Food)',
        'Kitchen Labour',
        'Kitchen Supplies',
        'Table and Dishware',
        'IHP Substandard Product',
        'R&M Equipment',
        'EBITDA'
      ];

      const sorted = orderedItems
        .map(name => itemsData.find(item => item.line_item_name === name))
        .filter((item): item is PLLineItem => item !== undefined);

      setLineItems(sorted);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '-';
    const formatted = `${Math.abs(value).toFixed(2)}%`;
    return value < 0 ? `(${formatted})` : formatted;
  };

  const getPTDVariance = (item: PLLineItem, foodSalesActual: number | null, totalSalesActual: number | null) => {
    const actual = item.current_actual;
    const budget = item.current_budget;
    const actualPct = item.current_actual_pct;
    const budgetPct = item.current_budget_pct;

    // Sales lines and EBITDA: simple dollar difference (positive variance is good)
    if (item.line_item_name === 'Food Sales' || item.line_item_name === 'Total Sales' || item.line_item_name === 'EBITDA') {
      if (actual === null || budget === null) {
        return { amount: 0, isGood: true, isNeutral: true };
      }
      const variance = actual - budget;
      const isGood = variance > 0; // For sales and EBITDA, positive variance is good
      return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
    }

    // Other lines: percentage-based calculation
    if (actualPct === null || budgetPct === null) {
      return { amount: 0, isGood: true, isNeutral: true };
    }

    const pctDiff = actualPct - budgetPct;

    // Cost of Sales (Food) and Kitchen Labour: divide by Food Sales
    if (item.line_item_name === 'Cost of Sales (Food)' || item.line_item_name === 'Kitchen Labour') {
      if (foodSalesActual === null || foodSalesActual === 0) {
        return { amount: 0, isGood: true, isNeutral: true };
      }
      const variance = (pctDiff / 100) * foodSalesActual;
      const isGood = variance < 0; // For costs, negative variance is good
      return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
    }

    // All other lines: divide by Total Sales
    if (totalSalesActual === null || totalSalesActual === 0) {
      return { amount: 0, isGood: true, isNeutral: true };
    }
    const variance = (pctDiff / 100) * totalSalesActual;
    const isGood = variance < 0; // For costs, negative variance is good
    return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
  };

  const getYTDVariance = (item: PLLineItem, foodSalesYTDActual: number | null, totalSalesYTDActual: number | null) => {
    const ytdActual = item.ytd_actual;
    const ytdBudget = item.ytd_budget;
    const ytdActualPct = item.ytd_actual_pct;
    const ytdBudgetPct = item.ytd_budget_pct;

    // Sales lines and EBITDA: simple dollar difference (positive variance is good)
    if (item.line_item_name === 'Food Sales' || item.line_item_name === 'Total Sales' || item.line_item_name === 'EBITDA') {
      if (ytdActual === null || ytdBudget === null) {
        return { amount: 0, isGood: true, isNeutral: true };
      }
      const variance = ytdActual - ytdBudget;
      const isGood = variance > 0; // For sales and EBITDA, positive variance is good
      return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
    }

    // Other lines: percentage-based calculation
    if (ytdActualPct === null || ytdBudgetPct === null) {
      return { amount: 0, isGood: true, isNeutral: true };
    }

    const pctDiff = ytdActualPct - ytdBudgetPct;

    // Cost of Sales (Food) and Kitchen Labour: divide by Food Sales
    if (item.line_item_name === 'Cost of Sales (Food)' || item.line_item_name === 'Kitchen Labour') {
      if (foodSalesYTDActual === null || foodSalesYTDActual === 0) {
        return { amount: 0, isGood: true, isNeutral: true };
      }
      const variance = (pctDiff / 100) * foodSalesYTDActual;
      const isGood = variance < 0; // For costs, negative variance is good
      return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
    }

    // All other lines: divide by Total Sales
    if (totalSalesYTDActual === null || totalSalesYTDActual === 0) {
      return { amount: 0, isGood: true, isNeutral: true };
    }
    const variance = (pctDiff / 100) * totalSalesYTDActual;
    const isGood = variance < 0; // For costs, negative variance is good
    return { amount: variance, isGood, isNeutral: Math.abs(variance) < 100 };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-semibold text-white">{location?.name}</h1>
              {availableWeeks.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2 transition-colors cursor-pointer">
                    <Calendar className="w-4 h-4 text-slate-300 shrink-0" />
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="appearance-none bg-transparent text-white text-sm font-medium pr-6 focus:outline-none cursor-pointer"
                    >
                      {availableWeeks.map(week => (
                        <option key={week} value={week} className="bg-cg-accent text-white">
                          Week Ending {new Date(week + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    PTD Actual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    PTD Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    PTD Variance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Prior Year
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    YTD Actual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    YTD Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    YTD Variance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item) => {
                  const foodSalesActual = lineItems.find(i => i.line_item_name === 'Food Sales')?.current_actual ?? null;
                  const totalSalesActual = lineItems.find(i => i.line_item_name === 'Total Sales')?.current_actual ?? null;
                  const foodSalesYTDActual = lineItems.find(i => i.line_item_name === 'Food Sales')?.ytd_actual ?? null;
                  const totalSalesYTDActual = lineItems.find(i => i.line_item_name === 'Total Sales')?.ytd_actual ?? null;

                  const ptdVariance = getPTDVariance(item, foodSalesActual, totalSalesActual);
                  const ptdVarianceColor = ptdVariance.isNeutral
                    ? 'text-slate-600'
                    : ptdVariance.isGood
                    ? 'text-green-600'
                    : 'text-red-600';

                  const ytdVariance = getYTDVariance(item, foodSalesYTDActual, totalSalesYTDActual);
                  const ytdVarianceColor = ytdVariance.isNeutral
                    ? 'text-slate-600'
                    : ytdVariance.isGood
                    ? 'text-green-600'
                    : 'text-red-600';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {item.line_item_name}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-slate-800">
                          {formatCurrency(item.current_actual)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPercent(item.current_actual_pct)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-slate-700">
                          {formatCurrency(item.current_budget)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPercent(item.current_budget_pct)}
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-semibold ${ptdVarianceColor}`}>
                        <div className="flex items-center justify-end gap-1">
                          {!ptdVariance.isNeutral && (
                            ptdVariance.amount > 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )
                          )}
                          {formatCurrency(ptdVariance.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-slate-700">
                          {formatCurrency(item.prior_year)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPercent(item.prior_year_pct)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-slate-700">
                          {formatCurrency(item.ytd_actual)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPercent(item.ytd_actual_pct)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-slate-700">
                          {formatCurrency(item.ytd_budget)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPercent(item.ytd_budget_pct)}
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-semibold ${ytdVarianceColor}`}>
                        <div className="flex items-center justify-end gap-1">
                          {!ytdVariance.isNeutral && (
                            ytdVariance.amount > 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )
                          )}
                          {formatCurrency(ytdVariance.amount)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
