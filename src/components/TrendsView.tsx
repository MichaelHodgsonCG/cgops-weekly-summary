import { useState, useEffect } from 'react';
import { TrendingUp, ChevronDown, MapPin } from 'lucide-react';
import { supabase, Location, PLLineItem } from '../lib/supabase';
import { useLocationFilter } from '../lib/useLocationFilter';

type WeekData = {
  weekEndingDate: string;
  value: number;
};

type LocationTrend = {
  location: Location;
  foodSales: WeekData[];
  foodCostPct: WeekData[];
  laborPct: WeekData[];
  ebitda: WeekData[];
};

type TrendsViewProps = {
  weekEndingDate: string;
};

type MetricType = 'foodSales' | 'foodCost' | 'labor' | 'ebitda';

export default function TrendsView({ weekEndingDate }: TrendsViewProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<LocationTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('foodSales');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const locationFilter = useLocationFilter('trends');

  useEffect(() => {
    loadLocations();
  }, [locationFilter.preferredLocations]);

  useEffect(() => {
    if (selectedLocationIds.length > 0) {
      loadTrendData();
    }
  }, [selectedLocationIds, weekEndingDate, weeks]);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (!error && data) {
      setLocations(data);
      if (locationFilter.hasPreferences && locationFilter.preferredLocations.length > 0) {
        const prefIds = data
          .filter(l => locationFilter.preferredLocations.includes(l.name))
          .map(l => l.id);
        setSelectedLocationIds(prefIds.length > 0 ? prefIds : data.slice(0, 3).map(l => l.id));
      } else if (data.length >= 3) {
        setSelectedLocationIds(data.slice(0, 3).map(l => l.id));
      }
    }
  };

  const loadTrendData = async () => {
    setLoading(true);

    const { data: allWeeks, error: weeksError } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('week_ending_date')
      .lte('week_ending_date', weekEndingDate)
      .in('location_id', selectedLocationIds)
      .order('week_ending_date', { ascending: false });

    if (weeksError || !allWeeks) {
      setLoading(false);
      return;
    }

    const uniqueDates = [...new Set(allWeeks.map(w => w.week_ending_date))].slice(0, weeks);
    const weekDates = uniqueDates.reverse();

    const { data: lineItems, error } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('*')
      .in('week_ending_date', weekDates)
      .in('location_id', selectedLocationIds);

    if (!error && lineItems) {
      const trends: LocationTrend[] = selectedLocationIds
        .map(locId => {
          const location = locations.find(l => l.id === locId);
          if (!location) return null;

          const foodSales: WeekData[] = [];
          const foodCostPct: WeekData[] = [];
          const laborPct: WeekData[] = [];
          const ebitda: WeekData[] = [];

          weekDates.forEach(week => {
            const weekItems = lineItems.filter(
              item => item.location_id === locId && item.week_ending_date === week
            );

            const foodSalesItem = weekItems.find(i => i.line_item_name === 'Food Sales');
            const foodCostItem = weekItems.find(i => i.line_item_name === 'Cost of Sales (Food)');
            const laborItem = weekItems.find(i => i.line_item_name === 'Kitchen Labour' || i.line_item_name === 'Labour');
            const ebitdaItem = weekItems.find(i => i.line_item_name === 'EBITDA');

            if (foodSalesItem?.current_actual !== null && foodSalesItem?.current_actual !== undefined) {
              foodSales.push({ weekEndingDate: week, value: foodSalesItem.current_actual });
            }
            if (foodCostItem?.current_actual_pct !== null && foodCostItem?.current_actual_pct !== undefined) {
              foodCostPct.push({ weekEndingDate: week, value: foodCostItem.current_actual_pct });
            }
            if (laborItem?.current_actual_pct !== null && laborItem?.current_actual_pct !== undefined) {
              laborPct.push({ weekEndingDate: week, value: laborItem.current_actual_pct });
            }
            if (ebitdaItem?.current_actual !== null && ebitdaItem?.current_actual !== undefined) {
              ebitda.push({ weekEndingDate: week, value: ebitdaItem.current_actual });
            }
          });

          return {
            location,
            foodSales,
            foodCostPct,
            laborPct,
            ebitda
          };
        })
        .filter((t): t is LocationTrend => t !== null);

      setTrendData(trends);
    }

    setLoading(false);
  };

  const toggleLocation = (locationId: string) => {
    if (selectedLocationIds.includes(locationId)) {
      if (selectedLocationIds.length > 1) {
        setSelectedLocationIds(selectedLocationIds.filter(id => id !== locationId));
      }
    } else {
      if (selectedLocationIds.length < 4) {
        setSelectedLocationIds([...selectedLocationIds, locationId]);
      }
    }
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
    return `${value.toFixed(1)}%`;
  };

  const getMetricData = (trend: LocationTrend): WeekData[] => {
    switch (selectedMetric) {
      case 'foodSales': return trend.foodSales;
      case 'foodCost': return trend.foodCostPct;
      case 'labor': return trend.laborPct;
      case 'ebitda': return trend.ebitda;
      default: return [];
    }
  };

  const formatValue = (value: number): string => {
    switch (selectedMetric) {
      case 'foodSales':
      case 'ebitda':
        return formatCurrency(value);
      case 'foodCost':
      case 'labor':
        return formatPercent(value);
      default:
        return value.toString();
    }
  };

  const getChartData = () => {
    const allValues = trendData.flatMap(trend => getMetricData(trend).map(d => d.value));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    return {
      min: minValue - padding,
      max: maxValue + padding,
      range: range + (padding * 2)
    };
  };

  const getYPosition = (value: number, chartData: ReturnType<typeof getChartData>) => {
    const normalized = (value - chartData.min) / chartData.range;
    return 100 - (normalized * 100);
  };

  const locationColors = [
    'rgb(51, 65, 85)',
    'rgb(14, 165, 233)',
    'rgb(34, 197, 94)',
    'rgb(251, 146, 60)',
  ];

  const metrics = [
    { id: 'foodSales' as MetricType, label: 'Food Sales' },
    { id: 'foodCost' as MetricType, label: 'Food Cost %' },
    { id: 'labor' as MetricType, label: 'Labour %' },
    { id: 'ebitda' as MetricType, label: 'EBITDA' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading trends...</div>
      </div>
    );
  }

  const chartData = getChartData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
        <button
          onClick={() => setShowLocationPicker(!showLocationPicker)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <div className="text-sm font-medium text-slate-800">Selected Locations ({selectedLocationIds.length})</div>
            <div className="text-xs text-slate-500 mt-1">Select up to 4 locations</div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
        </button>

        {showLocationPicker && (
          <div className="pt-4 border-t border-slate-200">
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
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-slate-800"
            >
              {metrics.map(metric => (
                <option key={metric.id} value={metric.id}>{metric.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Weeks</label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-slate-800"
            >
              <option value={4}>4 Weeks</option>
              <option value={8}>8 Weeks</option>
              <option value={13}>13 Weeks</option>
              <option value={26}>26 Weeks</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {metrics.find(m => m.id === selectedMetric)?.label} Trend
          </h3>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          {trendData.map((trend, index) => (
            <div key={trend.location.id} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: locationColors[index] }}></div>
              <span className="text-sm font-medium text-slate-700">{trend.location.name}</span>
            </div>
          ))}
        </div>

        <div className="relative h-64 sm:h-80">
          <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
            <line x1="60" y1="0" x2="60" y2="280" stroke="#e2e8f0" strokeWidth="2" />
            <line x1="60" y1="280" x2="800" y2="280" stroke="#e2e8f0" strokeWidth="2" />

            {trendData.map((trend, trendIndex) => {
              const data = getMetricData(trend);
              if (data.length === 0) return null;

              const points = data.map((point, index) => {
                const x = 60 + ((800 - 60) / (data.length - 1)) * index;
                const y = getYPosition(point.value, chartData) * 2.8;
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={trend.location.id}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={locationColors[trendIndex]}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {data.map((point, index) => {
                    const x = 60 + ((800 - 60) / (data.length - 1)) * index;
                    const y = getYPosition(point.value, chartData) * 2.8;
                    return (
                      <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="4"
                        fill={locationColors[trendIndex]}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-600 pr-2">
            <span>{formatValue(chartData.max)}</span>
            <span>{formatValue((chartData.max + chartData.min) / 2)}</span>
            <span>{formatValue(chartData.min)}</span>
          </div>
        </div>

        {trendData.length > 0 && trendData[0] && getMetricData(trendData[0]).length > 0 && (
          <div className="mt-4 flex justify-between text-xs text-slate-600 px-12">
            {getMetricData(trendData[0]).map((point, index) => (
              <span key={index} className="transform -rotate-45 origin-left">
                {new Date(point.weekEndingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ))}
          </div>
        )}
      </div>

      {trendData.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-600">Select locations to view trends</p>
        </div>
      )}
    </div>
  );
}
