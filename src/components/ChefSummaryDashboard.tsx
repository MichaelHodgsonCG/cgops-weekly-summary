import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFiscalCalendar } from '../lib/useFiscalCalendar';

interface Location {
  id: string;
  name: string;
  code: string;
}

interface SummaryStatus {
  location_id: string;
  location_name: string;
  location_code: string;
  has_summary: boolean;
  summary_id?: string;
}

export function ChefSummaryDashboard() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedPeriodWeek, setSelectedPeriodWeek] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<SummaryStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const { periods, weeks, availableYears } = useFiscalCalendar(selectedYear);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedPeriodWeek) {
      const [period, week] = selectedPeriodWeek.split('-').map(Number);
      checkSummaries(period, week);
    }
  }, [selectedYear, selectedPeriodWeek]);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('exclude_from_reporting', false)
      .order('name');

    if (error) {
      console.error('Error loading locations:', error);
      return;
    }

    setLocations(data || []);
  };

  const checkSummaries = async (period: number, week: number) => {
    setLoading(true);

    try {
      const { data: summaries, error } = await supabase
        .from('weekly_summary_chef_summary')
        .select('id, location_id')
        .eq('fiscal_year', selectedYear)
        .eq('period_number', period)
        .eq('week_number', week);

      if (error) {
        console.error('Error checking summaries:', error);
        setLoading(false);
        return;
      }

      const summaryMap = new Map(summaries?.map(s => [s.location_id, s.id]) || []);

      const statuses: SummaryStatus[] = locations.map(loc => ({
        location_id: loc.id,
        location_name: loc.name,
        location_code: loc.code,
        has_summary: summaryMap.has(loc.id),
        summary_id: summaryMap.get(loc.id),
      }));

      setSummaryStatuses(statuses);
    } finally {
      setLoading(false);
    }
  };

  const periodWeekOptions = weeks.map(w => {
    const startDate = new Date(w.start_date + 'T00:00:00');
    const endDate = new Date(w.end_date + 'T00:00:00');
    const label = `P${w.period} W${w.week} (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    return {
      value: `${w.period}-${w.week}`,
      label,
      period: w.period,
      week: w.week
    };
  });

  const summariesFound = summaryStatuses.filter(s => s.has_summary).length;
  const totalLocations = summaryStatuses.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Chef Summary Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          View and manage weekly chef summaries across all locations
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiscal Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value));
                setSelectedPeriodWeek('');
                setSummaryStatuses([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period / Week
            </label>
            <select
              value={selectedPeriodWeek}
              onChange={(e) => setSelectedPeriodWeek(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Period/Week</option>
              {periodWeekOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPeriodWeek && !loading && summaryStatuses.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Summary Status</h3>
              <div className="text-sm text-gray-600">
                {summariesFound} of {totalLocations} locations have summaries
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summaryStatuses.map(status => (
                <div
                  key={status.location_id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    status.has_summary
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {status.has_summary ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {status.location_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {status.location_code}
                      </div>
                    </div>
                  </div>
                  {status.has_summary && (
                    <FileText className="w-4 h-4 text-green-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-gray-600">
            Loading summary status...
          </div>
        )}

        {selectedPeriodWeek && !loading && summaryStatuses.length === 0 && locations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-gray-600">
            No summaries found for the selected period and week
          </div>
        )}

        {!selectedPeriodWeek ? (
          <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col items-center justify-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mb-3 text-gray-400" />
            <p className="text-sm">Select a fiscal year and period/week to view summary status</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
