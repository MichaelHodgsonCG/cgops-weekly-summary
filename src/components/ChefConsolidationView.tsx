import { useState, useEffect } from 'react';
import { Calendar, FileText } from 'lucide-react';
import { useFiscalCalendar } from '../lib/useFiscalCalendar';
import { getCurrentFiscalPeriod, FiscalWeek } from '../lib/fiscalCalendar';
import WeeklyExecutiveReport from './WeeklyExecutiveReport';
import { supabase } from '../lib/supabase';

export function ChefConsolidationView() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedPeriodWeek, setSelectedPeriodWeek] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<FiscalWeek | null>(null);

  const { weeks, availableYears } = useFiscalCalendar(selectedYear);

  useEffect(() => {
    loadCurrentPeriod();
  }, []);

  useEffect(() => {
    if (weeks.length > 0 && !selectedPeriodWeek) {
      loadLastWeekWithData();
    }
  }, [weeks, selectedPeriodWeek]);


  const loadCurrentPeriod = async () => {
    const period = await getCurrentFiscalPeriod();
    setCurrentPeriod(period);
  };

  const loadLastWeekWithData = async () => {
    const { data } = await supabase
      .from('weekly_summary_chef_summary')
      .select('fiscal_year, period_number, week_number')
      .order('fiscal_year', { ascending: false })
      .order('period_number', { ascending: false })
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSelectedYear(data.fiscal_year);
      setSelectedPeriodWeek(`${data.period_number}-${data.week_number}`);
    } else if (currentPeriod) {
      setSelectedYear(currentPeriod.fiscal_year);
      setSelectedPeriodWeek(`${currentPeriod.period}-${currentPeriod.week}`);
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

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const selectedWeekData = weeks.find(w => selectedPeriodWeek === `${w.period}-${w.week}`);
  const dateDisplay = selectedWeekData
    ? `${currentDate} Period ${selectedWeekData.period} Week ${selectedWeekData.week}`
    : currentDate;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg shadow-sm p-4 text-white">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 opacity-75" />
          <div className="text-sm font-semibold">
            {dateDisplay}
          </div>
        </div>
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
      </div>

      {selectedPeriodWeek && (() => {
        const [period, week] = selectedPeriodWeek.split('-').map(Number);
        return <WeeklyExecutiveReport fiscalYear={selectedYear} period={period} week={week} />;
      })()}

      {!selectedPeriodWeek && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select a period/week to view the executive report</p>
        </div>
      )}
    </div>
  );
}
