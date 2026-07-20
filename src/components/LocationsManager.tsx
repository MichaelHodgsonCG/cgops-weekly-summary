import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Save, X, MapPin } from 'lucide-react';
import { supabase, Location } from '../lib/supabase';

export default function LocationsManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editExcludeFromReporting, setEditExcludeFromReporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newExcludeFromReporting, setNewExcludeFromReporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (!error && data) {
      setLocations(data);
    }
    setLoading(false);
  };

  const handleEdit = (location: Location) => {
    setEditingId(location.id);
    setEditName(location.name);
    setEditCode(location.code);
    setEditExcludeFromReporting(location.exclude_from_reporting);
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCode('');
    setEditExcludeFromReporting(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editCode.trim()) {
      setMessage({ type: 'error', text: 'Name and code are required' });
      return;
    }

    const { error } = await supabase
      .from('locations')
      .update({
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        exclude_from_reporting: editExcludeFromReporting
      })
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update location' });
    } else {
      setMessage({ type: 'success', text: 'Location updated successfully' });
      setEditingId(null);
      loadLocations();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated P&L data.`)) {
      return;
    }

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete location' });
    } else {
      setMessage({ type: 'success', text: 'Location deleted successfully' });
      loadLocations();
    }
  };

  const handleAddLocation = async () => {
    if (!newName.trim() || !newCode.trim()) {
      setMessage({ type: 'error', text: 'Name and code are required' });
      return;
    }

    const { error } = await supabase
      .from('locations')
      .insert({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        exclude_from_reporting: newExcludeFromReporting
      });

    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'A location with this code already exists' });
      } else {
        setMessage({ type: 'error', text: 'Failed to add location' });
      }
    } else {
      setMessage({ type: 'success', text: 'Location added successfully' });
      setIsAdding(false);
      setNewName('');
      setNewCode('');
      setNewExcludeFromReporting(false);
      loadLocations();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading locations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Manage Locations
            </h1>
            <button
              onClick={() => {
                setIsAdding(true);
                setMessage(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </button>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`rounded-lg p-4 mb-4 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            {isAdding && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add New Location</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Location Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Code (e.g., BARRIE)"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                  />
                </div>
                <div className="mb-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newExcludeFromReporting}
                      onChange={(e) => setNewExcludeFromReporting(e.target.checked)}
                      className="rounded border-slate-300 text-slate-800 focus:ring-2 focus:ring-cg-accent/40"
                    />
                    Exclude from reporting
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddLocation}
                    className="flex items-center gap-1 px-3 py-2 bg-cg-accent text-white rounded-lg text-sm font-medium hover:bg-cg-accentHover transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewName('');
                      setNewCode('');
                      setNewExcludeFromReporting(false);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {editingId === location.id ? (
                    <>
                      <div className="flex-1">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editExcludeFromReporting}
                            onChange={(e) => setEditExcludeFromReporting(e.target.checked)}
                            className="rounded border-slate-300 text-slate-800 focus:ring-2 focus:ring-cg-accent/40"
                          />
                          Exclude from reporting
                        </label>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleSaveEdit(location.id)}
                          className="p-2 bg-cg-accent text-white rounded-lg hover:bg-cg-accentHover transition-colors"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-800">{location.name}</div>
                          {location.exclude_from_reporting && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              Not for reporting
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">{location.code}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(location)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(location.id, location.name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {locations.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No locations yet. Click "Add Location" to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
