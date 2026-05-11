import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calendar, AlertCircle, TrendingUp, Sparkles, RefreshCw,
  X, Search, Filter, ChevronLeft, ChevronRight, Loader2, AlertTriangle, MapPin
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLocationFilter } from '../lib/useLocationFilter';

interface DailyLogbookEntry {
  id: string;
  location_name: string;
  report_date: string;
  sales_actual: number;
  variance_forecast_to_sales: number;
  labor_cost_vs_sales_actual: number;
  journal_entry: string | null;
  weather_conditions: string | null;
  weather_high: number | null;
  weather_low: number | null;
}

interface DailyInsight {
  id: string;
  analysis_date: string;
  concerns_json: Array<{ location: string; issue: string; severity: string }>;
  highlights_json: Array<{ location: string; note: string }>;
  management_opportunities_json: Array<{ location: string; issue: string; coaching_note: string }>;
  themes_json: string[];
  ai_summary_json: { summary: string };
  missing_locations: string[];
  concerns_count: number;
  highlights_count: number;
  management_opportunities_count: number;
  missing_locations_count: number;
  generated_at: string;
  ai_provider: string;
}

export default function LogsView() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [entries, setEntries] = useState<DailyLogbookEntry[]>([]);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'concerns' | 'missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locationHistory, setLocationHistory] = useState<DailyLogbookEntry[]>([]);
  const [insightsPanelExpanded, setInsightsPanelExpanded] = useState(true);
  const [concernsExpanded, setConcernsExpanded] = useState(false);
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);
  const [managementExpanded, setManagementExpanded] = useState(false);
  const [themesExpanded, setThemesExpanded] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  const locationFilter = useLocationFilter('logs');

  useEffect(() => {
    fetchLocations();
    initializeDate();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchData();
    }
  }, [selectedDate]);

  async function initializeDate() {
    const { data } = await supabase
      .from('daily_logbook')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.report_date) {
      setSelectedDate(data.report_date);
    } else {
      setSelectedDate(new Date(Date.now() - 86400000).toISOString().split('T')[0]);
    }
  }

  useEffect(() => {
    const dismissed = localStorage.getItem(`alert-dismissed-${selectedDate}`);
    setDismissedAlert(dismissed === 'true');
  }, [selectedDate]);

  async function fetchLocations() {
    const { data } = await supabase
      .from('locations')
      .select('name')
      .eq('exclude_from_reporting', false)
      .order('name');
    setAllLocations((data || []).map(l => l.name));
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [entriesResult, insightResult] = await Promise.all([
        supabase
          .from('daily_logbook')
          .select('*')
          .eq('report_date', selectedDate)
          .order('location_name'),
        supabase
          .from('daily_insights')
          .select('*')
          .eq('analysis_date', selectedDate)
          .maybeSingle()
      ]);

      if (entriesResult.error) throw entriesResult.error;
      if (insightResult.error && insightResult.error.code !== 'PGRST116') {
        throw insightResult.error;
      }

      setEntries(entriesResult.data || []);
      setInsight(insightResult.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateInsights(forceRegenerate = false) {
    setGeneratingInsights(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-daily-insights`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          forceRegenerate,
          triggeredBy: 'manual'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      await fetchData();
    } catch (error) {
      console.error('Error generating insights:', error);
      alert('Failed to generate insights. Please try again.');
    } finally {
      setGeneratingInsights(false);
    }
  }

  async function openLocationModal(locationName: string) {
    setSelectedLocation(locationName);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_logbook')
      .select('*')
      .eq('location_name', locationName)
      .gte('report_date', thirtyDaysAgo)
      .order('report_date', { ascending: false });

    setLocationHistory(data || []);
  }

  function dismissAlert() {
    localStorage.setItem(`alert-dismissed-${selectedDate}`, 'true');
    setDismissedAlert(true);
  }

  function navigateLocation(direction: 'prev' | 'next') {
    if (!selectedLocation) return;

    const sortedLocations = filteredEntries.map(e => e.location_name).sort();
    const currentIndex = sortedLocations.indexOf(selectedLocation);

    if (direction === 'prev' && currentIndex > 0) {
      openLocationModal(sortedLocations[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < sortedLocations.length - 1) {
      openLocationModal(sortedLocations[currentIndex + 1]);
    }
  }

  const reportedLocations = entries.map(e => e.location_name);
  const missingLocations = allLocations.filter(loc => !reportedLocations.includes(loc));

  const locationConcerns = useMemo(() => new Map(
    (insight?.concerns_json || []).map(c => [c.location, c])
  ), [insight]);

  const filteredEntries = useMemo(() => {
    if (locationFilter.loading) return entries;
    return entries.filter(entry => {
      if (filterMode === 'concerns' && !locationConcerns.has(entry.location_name)) {
        return false;
      }
      if (searchQuery && !entry.journal_entry?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (locationFilter.isFiltered && locationFilter.hasPreferences) {
        return locationFilter.preferredLocations.includes(entry.location_name);
      }
      return true;
    });
  }, [entries, filterMode, searchQuery, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations, locationFilter.loading, locationConcerns]);

  const showMissingOnly = filterMode === 'missing';

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Daily Operations Journal</h2>
          <p className="text-sm text-neutral-500 mt-1">
            AI-powered insights from your location reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg"
          />
        </div>
      </div>

      {insight && (
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-200 overflow-hidden">
          <button
            onClick={() => setInsightsPanelExpanded(!insightsPanelExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-neutral-800">Daily Insights</h3>
              <span className="text-xs text-neutral-500">
                Generated {new Date(insight.generated_at).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    generateInsights(true);
                  }}
                  disabled={generatingInsights}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingInsights ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </>
                  )}
                </button>
              )}
              <ChevronLeft className={`w-5 h-5 text-neutral-600 transform transition-transform ${insightsPanelExpanded ? 'rotate-90' : '-rotate-90'}`} />
            </div>
          </button>

          {insightsPanelExpanded && (
            <div className="px-6 pb-6 space-y-4">
              {insight.ai_summary_json?.summary && (
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {insight.ai_summary_json.summary}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                  <button
                    onClick={() => setConcernsExpanded(!concernsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-sm text-neutral-800">Concerns</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {insight.concerns_count}
                      </span>
                    </div>
                  </button>
                  {concernsExpanded && (
                    <div className="px-4 pb-3 space-y-3">
                      {Object.entries(
                        insight.concerns_json.reduce((acc, concern) => {
                          if (!acc[concern.location]) acc[concern.location] = [];
                          acc[concern.location].push(concern.issue);
                          return acc;
                        }, {} as Record<string, string[]>)
                      ).map(([location, issues]) => (
                        <div key={location} className="border-t border-red-100 pt-3 first:border-0 first:pt-0">
                          <div className="font-semibold text-neutral-900 mb-2 text-base">{location}</div>
                          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-2">
                            {issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                  <button
                    onClick={() => setHighlightsExpanded(!highlightsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-50"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-sm text-neutral-800">Highlights</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {insight.highlights_count}
                      </span>
                    </div>
                  </button>
                  {highlightsExpanded && (
                    <div className="px-4 pb-3 space-y-3">
                      {Object.entries(
                        insight.highlights_json.reduce((acc, highlight) => {
                          if (!acc[highlight.location]) acc[highlight.location] = [];
                          acc[highlight.location].push(highlight.note);
                          return acc;
                        }, {} as Record<string, string[]>)
                      ).map(([location, notes]) => (
                        <div key={location} className="border-t border-green-100 pt-3 first:border-0 first:pt-0">
                          <div className="font-semibold text-neutral-900 mb-2 text-base">{location}</div>
                          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-2">
                            {notes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                  <button
                    onClick={() => setManagementExpanded(!managementExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-600 transform rotate-180" />
                      <span className="font-medium text-sm text-neutral-800">Management</span>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        {insight.management_opportunities_count || 0}
                      </span>
                    </div>
                  </button>
                  {managementExpanded && (
                    <div className="px-4 pb-3 space-y-3">
                      {(insight.management_opportunities_json || []).length > 0 ? (
                        insight.management_opportunities_json.map((opp, i) => (
                          <div key={i} className="border-t border-orange-100 pt-3 first:border-0 first:pt-0">
                            <div className="font-semibold text-neutral-900 mb-2 text-base">{opp.location}</div>
                            <div className="text-sm text-neutral-700 mb-1.5">{opp.issue}</div>
                            <div className="text-xs text-orange-600 italic bg-orange-50 px-2 py-1 rounded">{opp.coaching_note}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-neutral-500 italic">No coaching opportunities identified</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                  <button
                    onClick={() => setThemesExpanded(!themesExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm text-neutral-800">Themes</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {insight.themes_json.length}
                      </span>
                    </div>
                  </button>
                  {themesExpanded && (
                    <div className="px-4 pb-3">
                      <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600">
                        {insight.themes_json.map((theme, i) => (
                          <li key={i}>{theme}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!insight && entries.length > 0 && user?.role === 'admin' && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              No AI insights yet for this date. Generate insights to see patterns and concerns.
            </span>
          </div>
          <button
            onClick={() => generateInsights(false)}
            disabled={generatingInsights}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generatingInsights ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Generate Insights'
            )}
          </button>
        </div>
      )}

      {missingLocations.length > 0 && !dismissedAlert && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium text-amber-900 text-sm mb-1">
                  {reportedLocations.length} of {allLocations.length} locations reported
                </div>
                <div className="text-sm text-amber-700">
                  Missing: {missingLocations.join(', ')}
                </div>
              </div>
            </div>
            <button onClick={dismissAlert} className="text-amber-600 hover:text-amber-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {locationFilter.hasPreferences && (
            <button
              onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                locationFilter.isFiltered
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
            </button>
          )}
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('concerns')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              filterMode === 'concerns'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            Show Only Concerns
          </button>
          <button
            onClick={() => setFilterMode('missing')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              filterMode === 'missing'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            Show Only Missing
          </button>
        </div>

        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search journal entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 text-sm border border-neutral-300 rounded-lg"
          />
        </div>

        <div className="text-sm text-neutral-600">
          Showing {showMissingOnly ? missingLocations.length : filteredEntries.length} of {allLocations.length} locations
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {showMissingOnly ? (
          missingLocations.map(locationName => (
            <div
              key={locationName}
              className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 opacity-60"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-neutral-800">{locationName}</h3>
              </div>
              <div className="text-sm text-neutral-500 italic">
                No report submitted
              </div>
            </div>
          ))
        ) : (
          filteredEntries.map(entry => {
            const concern = locationConcerns.get(entry.location_name);
            const journalPreview = entry.journal_entry
              ? entry.journal_entry.split('\n').slice(0, 3).join('\n')
              : 'No journal entry';

            return (
              <button
                key={entry.id}
                onClick={() => openLocationModal(entry.location_name)}
                className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition-shadow text-left relative"
              >
                {concern && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-neutral-800 pr-4">{entry.location_name}</h3>
                </div>
                <p className="text-xs text-neutral-600 mb-3 line-clamp-3 whitespace-pre-wrap">
                  {journalPreview}
                </p>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{formatCurrency(entry.sales_actual)}</span>
                  <span className="text-blue-600 font-medium">Read More →</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedLocation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateLocation('prev')}
                  className="p-2 hover:bg-neutral-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-semibold text-neutral-800">{selectedLocation}</h3>
                <button
                  onClick={() => navigateLocation('next')}
                  className="p-2 hover:bg-neutral-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              {locationHistory.map(entry => (
                <div key={entry.id} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-500" />
                      <span className="font-medium text-neutral-800">
                        {new Date(entry.report_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className="text-sm text-neutral-600">
                      {formatCurrency(entry.sales_actual)}
                    </span>
                  </div>
                  {entry.weather_conditions && (
                    <div className="text-xs text-neutral-500 mb-2">
                      {entry.weather_high && entry.weather_low
                        ? `${entry.weather_high.toFixed(0)}°/${entry.weather_low.toFixed(0)}° - `
                        : ''}
                      {entry.weather_conditions}
                    </div>
                  )}
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                    {entry.journal_entry || 'No journal entry'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
