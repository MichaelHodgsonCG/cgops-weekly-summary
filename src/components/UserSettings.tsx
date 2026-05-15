import { useState, useEffect } from 'react';
import { User, Lock, Save, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function UserSettings() {
  const { user, isAdmin, isHQ, isExecChef } = useAuth();
  const hasHQAccess = isAdmin || isHQ || isExecChef;
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [savingLocations, setSavingLocations] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUserData();
    loadLocations();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('name, pin')
      .eq('id', user?.id)
      .maybeSingle();

    if (data) {
      setName(data.name || '');
      setPin(data.pin || '');
      setConfirmPin(data.pin || '');
    }

    if (error) {
      console.error('Error loading user data:', error);
      setMessage({ type: 'error', text: 'Failed to load user settings' });
    }

    setLoading(false);
  };

  const loadLocations = async () => {
    const { data: locsData } = await supabase
      .from('locations')
      .select('name')
      .eq('exclude_from_reporting', false)
      .order('name');

    if (locsData) {
      setAllLocations(locsData.map((l: { name: string }) => l.name));
    }

    if (user) {
      const { data: prefData } = await supabase
        .from('user_location_preferences')
        .select('location_name')
        .eq('user_id', user.id);

      if (prefData) {
        setSelectedLocations(new Set(prefData.map((r: { location_name: string }) => r.location_name)));
      }
    }
  };

  const handleSave = async () => {
    setMessage(null);

    if (pin !== confirmPin) {
      setMessage({ type: 'error', text: 'PINs do not match' });
      return;
    }

    if (pin && (pin.length < 4 || pin.length > 8)) {
      setMessage({ type: 'error', text: 'PIN must be between 4 and 8 digits' });
      return;
    }

    if (pin && !/^\d+$/.test(pin)) {
      setMessage({ type: 'error', text: 'PIN must contain only numbers' });
      return;
    }

    setSaving(true);

    const updates: { name?: string; pin?: string } = {};
    if (name) updates.name = name;
    if (pin) updates.pin = pin;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user?.id);

    if (error) {
      console.error('Error updating user:', error);
      setMessage({ type: 'error', text: `Failed to update settings: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Settings updated successfully' });
    }

    setSaving(false);
  };

  const toggleLocation = (locationName: string) => {
    setSelectedLocations(prev => {
      const next = new Set(prev);
      if (next.has(locationName)) {
        next.delete(locationName);
      } else {
        next.add(locationName);
      }
      return next;
    });
  };

  const handleSaveLocations = async () => {
    if (!user) return;
    setSavingLocations(true);
    setLocationMessage(null);

    await supabase
      .from('user_location_preferences')
      .delete()
      .eq('user_id', user.id);

    if (selectedLocations.size > 0) {
      const inserts = Array.from(selectedLocations).map(loc => ({
        user_id: user.id,
        location_name: loc,
      }));
      const { error } = await supabase
        .from('user_location_preferences')
        .insert(inserts);

      if (error) {
        setLocationMessage({ type: 'error', text: 'Failed to save location preferences' });
        setSavingLocations(false);
        return;
      }
    }

    const keys = Object.keys(localStorage).filter(k => k.startsWith('location_filter_'));
    keys.forEach(k => localStorage.removeItem(k));

    setLocationMessage({ type: 'success', text: 'Location preferences saved' });
    setSavingLocations(false);
  };

  const handleSelectAll = () => setSelectedLocations(new Set(allLocations));
  const handleClearAll = () => setSelectedLocations(new Set());

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {message && (
          <div
            className={`rounded-lg p-4 shadow-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border-2 border-green-200'
                : 'bg-red-50 text-red-800 border-2 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <User className="w-6 h-6" />
              User Settings
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Update your name and PIN
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                This name will be displayed in the application
              </p>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change PIN
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    New PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter 4-8 digit PIN"
                      maxLength={8}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    PIN must be 4-8 digits
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter PIN"
                      maxLength={8}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {hasHQAccess && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                My Locations
              </h2>
              <p className="text-slate-300 text-sm mt-1">
                Select your preferred locations to enable quick filtering across views
              </p>
            </div>

            <div className="p-6">
              {locationMessage && (
                <div
                  className={`rounded-lg p-3 mb-4 ${
                    locationMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    {locationMessage.type === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span className="font-medium">{locationMessage.text}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600">
                  {selectedLocations.size} of {allLocations.length} selected
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {allLocations.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No locations available</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {allLocations.map(loc => (
                    <label
                      key={loc}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedLocations.has(loc)
                          ? 'border-slate-700 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocations.has(loc)}
                        onChange={() => toggleLocation(loc)}
                        className="w-4 h-4 rounded border-slate-300 accent-slate-800"
                      />
                      <span className="text-sm font-medium text-slate-800 truncate">{loc}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  When saved, a "My Locations" toggle appears in each view
                </p>
                <button
                  onClick={handleSaveLocations}
                  disabled={savingLocations}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm"
                >
                  {savingLocations ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
