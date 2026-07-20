import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Save, AlertCircle, X, UtensilsCrossed, ChefHat } from 'lucide-react';

type Location = {
  id: string;
  name: string;
};

type WeekData = {
  upload_id: string;
  week_ending_date: string;
  location_name: string;
  actual_value: number;
  line_item_id: string;
};

type Tab = 'labour' | 'food-cost';

const TAB_CONFIG = {
  labour: {
    label: 'BOH Labour',
    lineItemName: 'Kitchen Labour',
    salesLineItemName: 'Food Sales',
    columnHeader: 'Kitchen Labour',
    successText: 'Labour value updated and PTD totals recalculated',
  },
  'food-cost': {
    label: 'Food Cost',
    lineItemName: 'Cost of Sales (Food)',
    salesLineItemName: 'Food Sales',
    columnHeader: 'Cost of Sales (Food)',
    successText: 'Food cost value updated and PTD totals recalculated',
  },
} as const;

export function PLAdjustments() {
  const [activeTab, setActiveTab] = useState<Tab>('labour');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const config = TAB_CONFIG[activeTab];

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadWeekData();
    } else {
      setWeekData([]);
    }
  }, [selectedLocation, activeTab]);

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .order('name');
    if (data) setLocations(data);
  };

  const loadWeekData = async () => {
    if (!selectedLocation) return;
    setLoading(true);

    const { data } = await supabase
      .from('weekly_summary_pl_line_items')
      .select(`
        id,
        upload_id,
        current_actual,
        pl_uploads:weekly_summary_pl_uploads!inner(
          week_ending_date,
          location_id,
          locations!inner(name)
        )
      `)
      .eq('line_item_name', config.lineItemName)
      .eq('pl_uploads.location_id', selectedLocation)
      .order('pl_uploads(week_ending_date)', { ascending: false });

    if (data) {
      setWeekData(data.map((item: any) => ({
        upload_id: item.upload_id,
        week_ending_date: item.pl_uploads.week_ending_date,
        location_name: item.pl_uploads.locations.name,
        actual_value: item.current_actual || 0,
        line_item_id: item.id,
      })));
    }

    setLoading(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setEditingWeek(null);
    setAdjustmentValue('');
    setMessage(null);
  };

  const startEditing = (weekEndingDate: string, currentValue: number) => {
    setEditingWeek(weekEndingDate);
    setAdjustmentValue(currentValue.toString());
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingWeek(null);
    setAdjustmentValue('');
  };

  const saveAdjustment = async (weekEndingDate: string, lineItemId: string) => {
    const newValue = parseFloat(adjustmentValue);
    if (isNaN(newValue)) {
      setMessage({ type: 'error', text: 'Please enter a valid number' });
      return;
    }

    setLoading(true);

    const { data: lineItem } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('upload_id')
      .eq('id', lineItemId)
      .single();

    if (!lineItem) {
      setMessage({ type: 'error', text: 'Could not find line item' });
      setLoading(false);
      return;
    }

    const { data: foodSales } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('current_actual')
      .eq('upload_id', lineItem.upload_id)
      .eq('line_item_name', config.salesLineItemName)
      .maybeSingle();

    const salesActual = foodSales?.current_actual || 0;
    const newPercentage = salesActual > 0 ? (newValue / salesActual) * 100 : null;

    const { error } = await supabase
      .from('weekly_summary_pl_line_items')
      .update({
        current_actual: newValue,
        current_actual_pct: newPercentage,
      })
      .eq('id', lineItemId);

    if (error) {
      setMessage({ type: 'error', text: `Error updating: ${error.message}` });
      setLoading(false);
      return;
    }

    await updatePTDTotals(weekEndingDate, lineItemId);

    setMessage({ type: 'success', text: config.successText });
    setEditingWeek(null);
    setAdjustmentValue('');
    await loadWeekData();
    setLoading(false);
  };

  const updatePTDTotals = async (weekEndingDate: string, _lineItemId: string) => {
    const { data: fiscalPeriod } = await supabase
      .from('fiscal_calendar')
      .select('period_start, period_end')
      .lte('period_start', weekEndingDate)
      .gte('period_end', weekEndingDate)
      .maybeSingle();

    if (!fiscalPeriod) return;

    const { data: weeksInPeriod } = await supabase
      .from('weekly_summary_pl_uploads')
      .select('id, week_ending_date')
      .eq('location_id', selectedLocation)
      .gte('week_ending_date', fiscalPeriod.period_start)
      .lte('week_ending_date', weekEndingDate)
      .order('week_ending_date');

    if (!weeksInPeriod || weeksInPeriod.length === 0) return;

    const uploadIds = weeksInPeriod.map(w => w.id);

    const { data: costItems } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('current_actual, upload_id')
      .eq('line_item_name', config.lineItemName)
      .in('upload_id', uploadIds);

    const { data: salesItems } = await supabase
      .from('weekly_summary_pl_line_items')
      .select('current_actual, upload_id')
      .eq('line_item_name', config.salesLineItemName)
      .in('upload_id', uploadIds);

    if (!costItems || !salesItems) return;

    let runningCostTotal = 0;
    let runningSalesTotal = 0;

    for (const week of weeksInPeriod) {
      const weekCost = costItems.find(item => item.upload_id === week.id);
      const weekSales = salesItems.find(item => item.upload_id === week.id);

      if (weekCost) runningCostTotal += weekCost.current_actual || 0;
      if (weekSales) runningSalesTotal += weekSales.current_actual || 0;

      const ytdPercentage = runningSalesTotal > 0 ? (runningCostTotal / runningSalesTotal) * 100 : null;

      await supabase
        .from('weekly_summary_pl_line_items')
        .update({ ytd_actual: runningCostTotal, ytd_actual_pct: ytdPercentage })
        .eq('line_item_name', config.lineItemName)
        .eq('upload_id', week.id);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">P&L Adjustments</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manually correct P&L line item values. PTD totals are recalculated automatically.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange('labour')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'labour'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          BOH Labour
        </button>
        <button
          onClick={() => handleTabChange('food-cost')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'food-cost'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          Food Cost
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{message.text}</div>
          <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Location</label>
          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setEditingWeek(null);
              setMessage(null);
            }}
            className="w-full md:w-96 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent bg-white text-slate-800"
          >
            <option value="">Choose a location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {selectedLocation && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {config.columnHeader}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : weekData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                      No data found for this location
                    </td>
                  </tr>
                ) : (
                  weekData.map((week) => (
                    <tr key={week.week_ending_date} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {formatDate(week.week_ending_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingWeek === week.week_ending_date ? (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            <input
                              type="number"
                              value={adjustmentValue}
                              onChange={(e) => setAdjustmentValue(e.target.value)}
                              className="w-36 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-slate-900">
                            {formatCurrency(week.actual_value)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {editingWeek === week.week_ending_date ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveAdjustment(week.week_ending_date, week.line_item_id)}
                              disabled={loading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cg-accent text-white rounded-lg hover:bg-cg-accentHover disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={loading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(week.week_ending_date, week.actual_value)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
