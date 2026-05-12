import { useState, useEffect } from 'react';
import { X, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase, Location, PLLineItem, getRegionDisplayName } from '../lib/supabase';

type LocationComparison = {
  location: Location;
  lineItems: PLLineItem[];
};

type ComparisonViewProps = {
  weekEndingDate: string;
};

export default function ComparisonView({ weekEndingDate }: ComparisonViewProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<LocationComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocationIds.length > 0) {
      loadComparisonData();
    }
  }, [selectedLocationIds, weekEndingDate]);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (!error && data) {
      setLocations(data);
      if (data.length >= 3) {
        setSelectedLocationIds(data.slice(0, 3).map(l => l.id));
      }
    }
  };

  const loadComparisonData = async () => {
    setLoading(true);

    const { data: lineItems, error } = await supabase
      .from('pl_line_items')
      .select('*')
      .eq('week_ending_date', weekEndingDate)
      .in('location_id', selectedLocationIds);

    if (!error && lineItems) {
      const comparisons: LocationComparison[] = selectedLocationIds
        .map(locId => {
          const location = locations.find(l => l.id === locId);
          const items = lineItems.filter(item => item.location_id === locId);
          return location ? { location, lineItems: items } : null;
        })
        .filter((c): c is LocationComparison => c !== null);

      setComparisonData(comparisons);
    }

    setLoading(false);
  };

  const toggleLocation = (locationId: string) => {
    if (selectedLocationIds.includes(locationId)) {
      if (selectedLocationIds.length > 1) {
        setSelectedLocationIds(selectedLocationIds.filter(id => id !== locationId));
      }
    } else {
      if (selectedLocationIds.length < 6) {
        setSelectedLocationIds([...selectedLocationIds, locationId]);
      }
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '-';
    return `${value.toFixed(2)}%`;
  };

  const getLineItem = (items: PLLineItem[], name: string) => {
    if (name === 'Labour') {
      return items.find(item => item.line_item_name === 'Kitchen Labour' || item.line_item_name === 'Labour');
    }
    return items.find(item => item.line_item_name === name);
  };

  const getBudgetVariance = (actual: number | null, budget: number | null) => {
    if (actual === null || budget === null) return null;
    return actual - budget;
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-slate-600';
    if (Math.abs(variance) < 100) return 'text-slate-600';
    return variance > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getPercentVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-slate-600';
    if (Math.abs(variance) < 0.5) return 'text-slate-600';
    return variance < 0 ? 'text-green-600' : 'text-red-600';
  };

  const MetricCard = ({ label, value, budget, variance, isPercent = false, showBudget = true }: {
    label: string;
    value: string;
    budget?: string;
    variance: number | null;
    isPercent?: boolean;
    showBudget?: boolean;
  }) => (
    <div className="space-y-1">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">{value}</div>
      {showBudget && budget && (
        <div className="text-xs text-slate-500">Budget: {budget}</div>
      )}
      {variance !== null && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${isPercent ? getPercentVarianceColor(variance) : getVarianceColor(variance)}`}>
          {variance > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : variance < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : null}
          <span>{isPercent ? formatPercent(Math.abs(variance)) : formatCurrency(Math.abs(variance))}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading comparison...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <button
          onClick={() => setShowLocationPicker(!showLocationPicker)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <div className="text-sm font-medium text-slate-800">Selected Locations ({selectedLocationIds.length})</div>
            <div className="text-xs text-slate-500 mt-1">
              {selectedLocationIds.length < 6 ? 'Select up to 6 locations' : 'Maximum reached'}
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
        </button>

        {showLocationPicker && (
          <div className="mt-4 pt-4 border-t border-slate-200 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {locations.map(location => (
                <label
                  key={location.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedLocationIds.includes(location.id)
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLocationIds.includes(location.id)}
                    onChange={() => toggleLocation(location.id)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-800">{location.name}</span>
                  {location.region && (
                    <span className="ml-auto text-xs text-slate-500">{getRegionDisplayName(location.region)}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-3 gap-4">
        {comparisonData.map(({ location, lineItems }) => {
          const foodSales = getLineItem(lineItems, 'Food Sales');
          const foodCost = getLineItem(lineItems, 'Cost of Sales (Food)');
          const labor = getLineItem(lineItems, 'Labour');
          const ebitda = getLineItem(lineItems, 'EBITDA');

          const foodSalesVar = getBudgetVariance(foodSales?.current_actual || null, foodSales?.current_budget || null);
          const foodCostVar = (foodCost?.current_actual_pct || null) !== null && (foodCost?.current_budget_pct || null) !== null
            ? (foodCost!.current_actual_pct! - foodCost!.current_budget_pct!)
            : null;
          const laborVar = (labor?.current_actual_pct || null) !== null && (labor?.current_budget_pct || null) !== null
            ? (labor!.current_actual_pct! - labor!.current_budget_pct!)
            : null;
          const ebitdaVar = getBudgetVariance(ebitda?.current_actual || null, ebitda?.current_budget || null);

          return (
            <div key={location.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <h3 className="text-base font-semibold text-white truncate">{location.name}</h3>
                {location.region && (
                  <span className="text-xs text-slate-300">{getRegionDisplayName(location.region)}</span>
                )}
              </div>

              <div className="p-4 space-y-4">
                <MetricCard
                  label="Food Sales"
                  value={formatCurrency(foodSales?.current_actual || null)}
                  budget={formatCurrency(foodSales?.current_budget || null)}
                  variance={foodSalesVar}
                />

                <MetricCard
                  label="Food Cost %"
                  value={formatPercent(foodCost?.current_actual_pct || null)}
                  budget={formatPercent(foodCost?.current_budget_pct || null)}
                  variance={foodCostVar}
                  isPercent
                />

                <MetricCard
                  label="Labour %"
                  value={formatPercent(labor?.current_actual_pct || null)}
                  budget={formatPercent(labor?.current_budget_pct || null)}
                  variance={laborVar}
                  isPercent
                />

                <MetricCard
                  label="EBITDA"
                  value={formatCurrency(ebitda?.current_actual || null)}
                  budget={formatCurrency(ebitda?.current_budget || null)}
                  variance={ebitdaVar}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="md:hidden space-y-4">
        {comparisonData.map(({ location, lineItems }) => {
          const foodSales = getLineItem(lineItems, 'Food Sales');
          const foodCost = getLineItem(lineItems, 'Cost of Sales (Food)');
          const labor = getLineItem(lineItems, 'Labour');
          const ebitda = getLineItem(lineItems, 'EBITDA');

          const foodSalesVar = getBudgetVariance(foodSales?.current_actual || null, foodSales?.current_budget || null);
          const foodCostVar = (foodCost?.current_actual_pct || null) !== null && (foodCost?.current_budget_pct || null) !== null
            ? (foodCost!.current_actual_pct! - foodCost!.current_budget_pct!)
            : null;
          const laborVar = (labor?.current_actual_pct || null) !== null && (labor?.current_budget_pct || null) !== null
            ? (labor!.current_actual_pct! - labor!.current_budget_pct!)
            : null;
          const ebitdaVar = getBudgetVariance(ebitda?.current_actual || null, ebitda?.current_budget || null);

          return (
            <div key={location.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">{location.name}</h3>
                  {location.region && (
                    <span className="text-xs text-slate-300">{getRegionDisplayName(location.region)}</span>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-4">
                <MetricCard
                  label="Food Sales"
                  value={formatCurrency(foodSales?.current_actual || null)}
                  budget={formatCurrency(foodSales?.current_budget || null)}
                  variance={foodSalesVar}
                />

                <MetricCard
                  label="Food Cost %"
                  value={formatPercent(foodCost?.current_actual_pct || null)}
                  budget={formatPercent(foodCost?.current_budget_pct || null)}
                  variance={foodCostVar}
                  isPercent
                />

                <MetricCard
                  label="Labour %"
                  value={formatPercent(labor?.current_actual_pct || null)}
                  budget={formatPercent(labor?.current_budget_pct || null)}
                  variance={laborVar}
                  isPercent
                />

                <MetricCard
                  label="EBITDA"
                  value={formatCurrency(ebitda?.current_actual || null)}
                  budget={formatCurrency(ebitda?.current_budget || null)}
                  variance={ebitdaVar}
                />
              </div>
            </div>
          );
        })}
      </div>

      {comparisonData.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-600">Select locations to compare</p>
        </div>
      )}
    </div>
  );
}
