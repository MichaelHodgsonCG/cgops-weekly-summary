import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

interface LocationMapping {
  id: string;
  source_name: string;
  canonical_location_id: string | null;
  canonical_location_name: string;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: string;
  name: string;
}

export default function LocationMappingsManager() {
  const [mappings, setMappings] = useState<LocationMapping[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMapping, setNewMapping] = useState({
    source_name: '',
    canonical_location_name: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [mappingsResult, locationsResult] = await Promise.all([
        supabase.from('location_mappings').select('*').order('source_name'),
        supabase.from('locations').select('id, name').order('name')
      ]);

      if (mappingsResult.error) throw mappingsResult.error;
      if (locationsResult.error) throw locationsResult.error;

      setMappings(mappingsResult.data || []);
      setLocations(locationsResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMapping() {
    if (!newMapping.source_name || !newMapping.canonical_location_name) {
      setError('Both fields are required');
      return;
    }

    try {
      const selectedLocation = locations.find(
        loc => loc.name === newMapping.canonical_location_name
      );

      const { error: insertError } = await supabase
        .from('location_mappings')
        .insert({
          source_name: newMapping.source_name,
          canonical_location_id: selectedLocation?.id || null,
          canonical_location_name: newMapping.canonical_location_name
        });

      if (insertError) throw insertError;

      setNewMapping({ source_name: '', canonical_location_name: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add mapping');
    }
  }

  async function handleDeleteMapping(id: string) {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('location_mappings')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mapping');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading location mappings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Location Mappings</h2>
          <p className="mt-1 text-sm text-gray-600">
            Map location names from emails and uploads to canonical location names
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Mapping</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Name (as it appears in emails)
            </label>
            <input
              type="text"
              value={newMapping.source_name}
              onChange={(e) => setNewMapping({ ...newMapping, source_name: e.target.value })}
              placeholder="e.g., New feedback for Beertown - London White Oaks"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Canonical Location Name
            </label>
            <select
              value={newMapping.canonical_location_name}
              onChange={(e) => setNewMapping({ ...newMapping, canonical_location_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleAddMapping}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Mapping
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Existing Mappings ({mappings.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canonical Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No location mappings yet. Add one above to get started.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {mapping.source_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {mapping.canonical_location_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(mapping.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
