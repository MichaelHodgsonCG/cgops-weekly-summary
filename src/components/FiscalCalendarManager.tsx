import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface FiscalWeek {
  id: string;
  fiscal_year: number;
  period: number;
  week: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export default function FiscalCalendarManager() {
  const [weeks, setWeeks] = useState<FiscalWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [generatingYear, setGeneratingYear] = useState<number>(new Date().getFullYear());
  const [yearStartDate, setYearStartDate] = useState<string>('');

  useEffect(() => {
    fetchWeeks();
  }, [selectedYear]);

  const fetchWeeks = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('fiscal_calendar')
        .select('*')
        .eq('fiscal_year', selectedYear)
        .order('period', { ascending: true })
        .order('week', { ascending: true });

      if (fetchError) throw fetchError;
      setWeeks(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateFiscalYear = async () => {
    if (!yearStartDate) {
      setError('Please enter a start date for the fiscal year');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const startDate = new Date(yearStartDate);
      const weeksToGenerate: Omit<FiscalWeek, 'id'>[] = [];

      for (let period = 1; period <= 13; period++) {
        for (let week = 1; week <= 4; week++) {
          const weekIndex = (period - 1) * 4 + (week - 1);
          const weekStart = new Date(startDate);
          weekStart.setDate(startDate.getDate() + weekIndex * 7);

          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);

          weeksToGenerate.push({
            fiscal_year: generatingYear,
            period,
            week,
            start_date: weekStart.toISOString().split('T')[0],
            end_date: weekEnd.toISOString().split('T')[0],
            is_current: false,
          });
        }
      }

      const { error: insertError } = await supabase
        .from('fiscal_calendar')
        .insert(weeksToGenerate);

      if (insertError) throw insertError;

      setSuccess(`Generated ${weeksToGenerate.length} weeks for fiscal year ${generatingYear}`);
      if (generatingYear === selectedYear) {
        await fetchWeeks();
      }
      setYearStartDate('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentPeriod = async (weekId: string) => {
    try {
      setError(null);
      setSuccess(null);

      await supabase
        .from('fiscal_calendar')
        .update({ is_current: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: updateError } = await supabase
        .from('fiscal_calendar')
        .update({ is_current: true })
        .eq('id', weekId);

      if (updateError) throw updateError;

      setSuccess('Current period updated successfully');
      await fetchWeeks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteWeek = async (id: string) => {
    if (!confirm('Are you sure you want to delete this week?')) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('fiscal_calendar')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Week deleted successfully');
      await fetchWeeks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteFiscalYear = async () => {
    if (!confirm(`Are you sure you want to delete all weeks for fiscal year ${selectedYear}?`)) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('fiscal_calendar')
        .delete()
        .eq('fiscal_year', selectedYear);

      if (deleteError) throw deleteError;

      setSuccess(`Deleted all weeks for fiscal year ${selectedYear}`);
      await fetchWeeks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getCurrentWeek = () => weeks.find(w => w.is_current);
  const currentWeek = getCurrentWeek();

  const groupedByPeriod = weeks.reduce((acc, week) => {
    if (!acc[week.period]) acc[week.period] = [];
    acc[week.period].push(week);
    return acc;
  }, {} as Record<number, FiscalWeek[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Fiscal Calendar Management</h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {currentWeek && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Current Period</h3>
          <p className="text-blue-800">
            FY{currentWeek.fiscal_year} - Period {currentWeek.period}, Week {currentWeek.week}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            {new Date(currentWeek.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(currentWeek.end_date + 'T00:00:00').toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Fiscal Year</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiscal Year
            </label>
            <input
              type="number"
              value={generatingYear}
              onChange={(e) => setGeneratingYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Start Date
            </label>
            <input
              type="date"
              value={yearStartDate}
              onChange={(e) => setYearStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateFiscalYear}
              disabled={loading || !yearStartDate}
              className="w-full px-4 py-2 bg-cg-accent text-white rounded-lg hover:bg-cg-accentHover disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Year
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          This will generate 13 periods × 4 weeks = 52 weeks for the fiscal year
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">View Fiscal Year</h3>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {weeks.length > 0 && (
              <button
                onClick={deleteFiscalYear}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Year
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No fiscal calendar data for {selectedYear}. Generate a fiscal year to get started.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedByPeriod)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map((periodKey) => {
                const period = parseInt(periodKey);
                const periodWeeks = groupedByPeriod[period];

                return (
                  <div key={period} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Period {period}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {periodWeeks.map((week) => (
                        <div
                          key={week.id}
                          className={`border rounded-lg p-3 ${
                            week.is_current
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">Week {week.week}</span>
                            <div className="flex items-center gap-1">
                              {!week.is_current && (
                                <button
                                  onClick={() => setCurrentPeriod(week.id)}
                                  className="p-1 text-gray-400 hover:text-blue-600"
                                  title="Set as current"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteWeek(week.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {new Date(week.start_date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            -{' '}
                            {new Date(week.end_date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          {week.is_current && (
                            <div className="mt-2 text-xs font-medium text-blue-600">Current</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
