import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, ChevronRight, Upload, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase, Location, PLLineItem, getRegionDisplayName } from '../lib/supabase';
import { parseCSV, ParsedLineItem } from '../lib/csvParser';
import { parseExcel } from '../lib/excelParser';

type LocationData = {
  location: Location;
  lineItems: PLLineItem[];
  weekEndingDate: string | null;
};

type LocationComparison = {
  location: Location;
  lineItems: PLLineItem[];
};

export default function Dashboard({
  onLocationClick,
  selectedWeek: parentSelectedWeek,
  setSelectedWeek: parentSetSelectedWeek,
  availableWeeks: parentAvailableWeeks
}: {
  onLocationClick: (locationId: string, weekEndingDate: string) => void;
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  availableWeeks: string[];
}) {
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedWeek = parentSelectedWeek;
  const setSelectedWeek = parentSetSelectedWeek;
  const availableWeeks = parentAvailableWeeks;

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<LocationComparison[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    loadLocations();
    setWeekEndingDate(getMostRecentSunday());
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadDashboardData(selectedWeek);
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (selectedLocationIds.length > 0 && selectedWeek) {
      loadComparisonData();
    }
  }, [selectedLocationIds, selectedWeek]);

  const getMostRecentSunday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    return sunday.toISOString().split('T')[0];
  };

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('exclude_from_reporting', false)
      .order('name');

    if (!error && data) {
      setLocations(data);
      if (data.length >= 3) {
        setSelectedLocationIds(data.slice(0, 3).map(l => l.id));
      }
    }
  };


  const loadDashboardData = async (weekEndingDate: string) => {
    setLoading(true);

    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('exclude_from_reporting', false)
      .order('name');

    if (locError || !locations) {
      setLoading(false);
      return;
    }

    const { data: lineItems, error: itemsError } = await supabase
      .from('pl_line_items')
      .select('*')
      .eq('week_ending_date', weekEndingDate);

    if (itemsError) {
      setLoading(false);
      return;
    }

    const grouped: LocationData[] = locations.map(location => {
      const items = lineItems?.filter(item => item.location_id === location.id) || [];
      return {
        location,
        lineItems: items,
        weekEndingDate: items.length > 0 ? weekEndingDate : null
      };
    });

    setLocationData(grouped);
    setLoading(false);
  };

  const loadComparisonData = async () => {
    setLoadingComparison(true);

    const { data: lineItems, error } = await supabase
      .from('pl_line_items')
      .select('*')
      .eq('week_ending_date', selectedWeek)
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

    setLoadingComparison(false);
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

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const findOrCreateLocation = async (locationName: string): Promise<string | null> => {
    const normalizedInput = normalizeText(locationName);

    let matchedLocation = locations.find(
      loc => normalizeText(loc.name) === normalizedInput
    );

    if (matchedLocation) {
      return matchedLocation.id;
    }

    const { data: newLocation, error } = await supabase
      .from('locations')
      .insert({ name: locationName })
      .select()
      .single();

    if (error) {
      console.error('Error creating location:', error);
      return null;
    }

    setLocations([...locations, newLocation]);
    return newLocation.id;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);

      let result: { lineItems: ParsedLineItem[]; errors: string[]; locationName?: string; weekEndingDate?: string };

      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        result = await parseExcel(selectedFile);
      } else {
        const text = await selectedFile.text();
        result = parseCSV(text);
      }

      if (result.locationName) {
        const locationId = await findOrCreateLocation(result.locationName);
        if (locationId) {
          setSelectedLocation(locationId);
        }
      }

      if (result.weekEndingDate) {
        setWeekEndingDate(result.weekEndingDate);
      }

      if (result.errors.length > 0) {
        setMessage({ type: 'error', text: result.errors.join(', ') });
        setPreview([]);
      } else {
        setPreview(result.lineItems.map(item => item.line_item_name));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedLocation || !weekEndingDate) {
      setMessage({ type: 'error', text: 'Please select a location, date, and file' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      let result: { lineItems: ParsedLineItem[]; errors: string[]; locationName?: string; weekEndingDate?: string };

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        result = await parseExcel(file);
      } else {
        const text = await file.text();
        result = parseCSV(text);
      }

      if (result.errors.length > 0) {
        setMessage({ type: 'error', text: result.errors.join(', ') });
        setUploading(false);
        return;
      }

      const { lineItems } = result;

      const { data: existingUpload } = await supabase
        .from('pl_uploads')
        .select('id')
        .eq('location_id', selectedLocation)
        .eq('week_ending_date', weekEndingDate)
        .maybeSingle();

      if (existingUpload) {
        await supabase
          .from('pl_line_items')
          .delete()
          .eq('upload_id', existingUpload.id);

        await supabase
          .from('pl_uploads')
          .delete()
          .eq('id', existingUpload.id);
      }

      const { data: upload, error: uploadError } = await supabase
        .from('pl_uploads')
        .insert({
          location_id: selectedLocation,
          week_ending_date: weekEndingDate,
          filename: file.name,
          status: 'completed'
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      const lineItemsToInsert = lineItems.map(item => ({
        upload_id: upload.id,
        location_id: selectedLocation,
        week_ending_date: weekEndingDate,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('pl_line_items')
        .insert(lineItemsToInsert);

      if (itemsError) throw itemsError;

      setMessage({ type: 'success', text: `Successfully uploaded ${lineItems.length} line items` });
      setFile(null);
      setPreview([]);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await loadAvailableWeeks();
      if (selectedWeek) {
        await loadDashboardData(selectedWeek);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload data. Please try again.' });
    } finally {
      setUploading(false);
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

  const getVarianceColor = (actual: number | null, budget: number | null) => {
    if (actual === null || budget === null) return 'text-slate-600';
    const variance = actual - budget;
    if (Math.abs(variance) < 100) return 'text-slate-600';
    return variance > 0 ? 'text-red-600' : 'text-green-600';
  };

  const getBudgetVariance = (actual: number | null, budget: number | null) => {
    if (actual === null || budget === null) return null;
    return actual - budget;
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
        <div className={`flex items-center gap-1 text-xs font-semibold ${isPercent ? getPercentVarianceColor(variance) : (variance >= 0 ? 'text-green-600' : 'text-red-600')}`}>
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
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {availableWeeks.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Report Date:</span>
          </div>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableWeeks.map((week) => (
              <option key={week} value={week}>
                {new Date(week + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload P&L Data
            </h2>
            <p className="mt-1 text-sm text-slate-500">Upload weekly P&L reports in CSV or Excel format</p>
          </div>

          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <Upload className="w-5 h-5" />
            <span>{uploading ? 'Uploading...' : 'Upload P&L'}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {file && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-slate-800">{file.name}</span>
              </div>

              {(selectedLocation || weekEndingDate) && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-3">
                  <h3 className="text-xs font-semibold text-blue-900 mb-2">
                    Auto-Detected Information:
                  </h3>
                  <div className="space-y-1 text-xs text-blue-800">
                    {selectedLocation && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span>
                          <strong>Location:</strong>{' '}
                          {locations.find(l => l.id === selectedLocation)?.name}
                        </span>
                      </div>
                    )}
                    {weekEndingDate && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span>
                          <strong>Week Ending:</strong>{' '}
                          {new Date(weekEndingDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preview.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs font-medium text-slate-700 mb-2">
                    Detected Line Items ({preview.length}):
                  </h3>
                  <div className="grid grid-cols-2 gap-1">
                    {preview.slice(0, 6).map((item, index) => (
                      <div key={index} className="text-xs text-slate-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                  {preview.length > 6 && (
                    <div className="text-xs text-slate-500 mt-1">
                      +{preview.length - 6} more items
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedLocation || !weekEndingDate}
                className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {uploading ? 'Processing...' : 'Confirm Upload'}
              </button>
            </div>

            {message && (
              <div
                className={`rounded-lg p-3 flex items-start gap-2 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {locationData.map(({ location, lineItems, weekEndingDate }) => {
          const totalSales = getLineItem(lineItems, 'Total Sales');
          const ebitda = getLineItem(lineItems, 'EBITDA');
          const foodCost = getLineItem(lineItems, 'Cost of Sales (Food)');

          return (
            <div
              key={location.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => weekEndingDate && onLocationClick(location.id, weekEndingDate)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{location.name}</h3>
                    {!weekEndingDate && (
                      <span className="text-sm text-slate-500">No data for this week</span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>

                {weekEndingDate && lineItems.length > 0 && (
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <div className="text-sm text-slate-600">Total Sales</div>
                      <div className="text-xl font-semibold text-slate-800">
                        {formatCurrency(totalSales?.current_actual || null)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Budget: {formatCurrency(totalSales?.current_budget || null)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm text-slate-600">EBITDA</div>
                      <div className={`text-xl font-semibold ${getVarianceColor(ebitda?.current_actual || null, ebitda?.current_budget || null)}`}>
                        {formatCurrency(ebitda?.current_actual || null)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatPercent(ebitda?.current_actual_pct || null)} of sales
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm text-slate-600">Food Cost %</div>
                      <div className={`text-xl font-semibold ${getVarianceColor(foodCost?.current_actual_pct || null, foodCost?.current_budget_pct || null)}`}>
                        {formatPercent(foodCost?.current_actual_pct || null)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Budget: {formatPercent(foodCost?.current_budget_pct || null)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {locationData.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-600">No data available. Please upload P&L data first.</p>
        </div>
      )}

      <div className="pt-6 border-t-4 border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Compare Locations</h2>

        <div className="space-y-4">
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

              const foodCostVar = (foodCost?.current_actual_pct || null) !== null &&
                                  (foodCost?.current_budget_pct || null) !== null &&
                                  (foodSales?.current_actual || 0) > 0
                ? ((foodCost!.current_actual_pct! - foodCost!.current_budget_pct!) / 100) * foodSales!.current_actual!
                : null;

              const laborVar = (labor?.current_actual_pct || null) !== null &&
                               (labor?.current_budget_pct || null) !== null &&
                               (foodSales?.current_actual || 0) > 0
                ? ((labor!.current_actual_pct! - labor!.current_budget_pct!) / 100) * foodSales!.current_actual!
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
                    />

                    <MetricCard
                      label="Labour %"
                      value={formatPercent(labor?.current_actual_pct || null)}
                      budget={formatPercent(labor?.current_budget_pct || null)}
                      variance={laborVar}
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

              const foodCostVar = (foodCost?.current_actual_pct || null) !== null &&
                                  (foodCost?.current_budget_pct || null) !== null &&
                                  (foodSales?.current_actual || 0) > 0
                ? ((foodCost!.current_actual_pct! - foodCost!.current_budget_pct!) / 100) * foodSales!.current_actual!
                : null;

              const laborVar = (labor?.current_actual_pct || null) !== null &&
                               (labor?.current_budget_pct || null) !== null &&
                               (foodSales?.current_actual || 0) > 0
                ? ((labor!.current_actual_pct! - labor!.current_budget_pct!) / 100) * foodSales!.current_actual!
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
                    />

                    <MetricCard
                      label="Labour %"
                      value={formatPercent(labor?.current_actual_pct || null)}
                      budget={formatPercent(labor?.current_budget_pct || null)}
                      variance={laborVar}
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
      </div>
    </div>
  );
}
