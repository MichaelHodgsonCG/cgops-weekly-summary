import React, { useState, useEffect } from 'react';
import { ChefHat, ArrowLeft, CreditCard as Edit2, Calendar, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WeeklyChefSummary } from './WeeklyChefSummary';
import { ChefSummaryImporter } from './ChefSummaryImporter';

interface Location {
  id: string;
  name: string;
}

interface ChefSummary {
  id: string;
  location_id: string;
  week_number: number;
  period_number: number;
  fiscal_year: number;
  created_at: string;
}

export function ChefSummariesManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [summaries, setSummaries] = useState<ChefSummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<ChefSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewSummary, setShowNewSummary] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadSummaries(selectedLocation.id);
    }
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async (locationId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('weekly_chef_summary')
        .select('id, location_id, week_number, period_number, fiscal_year, created_at')
        .eq('location_id', locationId)
        .order('fiscal_year', { ascending: false })
        .order('period_number', { ascending: false })
        .order('week_number', { ascending: false });

      if (error) throw error;
      setSummaries(data || []);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLocations = () => {
    setSelectedLocation(null);
    setSelectedSummary(null);
    setShowNewSummary(false);
    setSummaries([]);
  };

  const handleBackToSummaries = () => {
    setSelectedSummary(null);
    setShowNewSummary(false);
    if (selectedLocation) {
      loadSummaries(selectedLocation.id);
    }
  };

  if (showNewSummary && selectedLocation) {
    return (
      <div>
        <button
          onClick={handleBackToSummaries}
          className="mb-4 flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Summaries
        </button>
        <WeeklyChefSummary
          locationId={selectedLocation.id}
          locationName={selectedLocation.name}
        />
      </div>
    );
  }

  if (selectedSummary && selectedLocation) {
    return (
      <div>
        <button
          onClick={handleBackToSummaries}
          className="mb-4 flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Summaries
        </button>
        <WeeklyChefSummary
          locationId={selectedLocation.id}
          locationName={selectedLocation.name}
          summaryId={selectedSummary.id}
        />
      </div>
    );
  }

  if (selectedLocation) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToLocations}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Locations
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{selectedLocation.name}</h2>
              <p className="text-slate-600">Chef Summaries</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewSummary(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ChefHat className="w-5 h-5" />
            New Summary
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            <p className="mt-2 text-slate-600">Loading summaries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <ChefHat className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No summaries yet</h3>
            <p className="text-slate-600 mb-4">Create your first chef summary for this location</p>
            <button
              onClick={() => setShowNewSummary(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ChefHat className="w-5 h-5" />
              Create Summary
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        FY {summary.fiscal_year} - P{summary.period_number} W{summary.week_number}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {new Date(summary.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSummary(summary)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Summary
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Chef Summaries</h2>
        <p className="text-slate-600">Import chef summaries or select a location to manage them</p>
      </div>

      <div className="mb-8">
        <ChefSummaryImporter />
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Browse by Location</h3>
        <p className="text-slate-600">Select a location to view and edit existing summaries</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
          <p className="mt-2 text-slate-600">Loading locations...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <ChefHat className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No locations found</h3>
          <p className="text-slate-600">Add locations in the Locations section first</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => setSelectedLocation(location)}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all hover:border-slate-300 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <ChefHat className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{location.name}</h3>
                  <p className="text-sm text-slate-600">View summaries</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
