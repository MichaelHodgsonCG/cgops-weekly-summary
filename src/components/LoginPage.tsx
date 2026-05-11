import React, { useState, useEffect } from 'react';
import { LogIn, Lock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onLogin: (userId: string, userName: string, role: string) => void;
}

interface Location {
  id: string;
  name: string;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('exclude_from_reporting', false)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error loading locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedLocation) {
      setError('Please select your location.');
      return;
    }

    setLoading(true);

    try {
      const selectedLocationName = locations.find(l => l.id === selectedLocation)?.name || '';

      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!user) {
        setError('Invalid PIN. Please try again.');
        setPin('');
        setLoading(false);
        return;
      }

      const userRestaurant = (user.restaurant || '').toLowerCase().trim();
      const locationName = selectedLocationName.toLowerCase().trim();
      const isAdmin = user.role?.toLowerCase() === 'admin';
      const isHQ = user.role?.toLowerCase() === 'hq';

      if (!isAdmin && !isHQ && userRestaurant !== locationName) {
        setError('PIN does not match the selected location.');
        setPin('');
        setLoading(false);
        return;
      }

      onLogin(user.id, user.name || selectedLocationName, user.role);
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
      setPin(value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
            <p className="text-gray-500 mt-2">Select your location and enter your PIN</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Location
                </span>
              </label>
              {loadingLocations ? (
                <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 text-sm">
                  Loading locations...
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="location"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    disabled={loading}
                    className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white text-gray-800 cursor-pointer"
                  >
                    <option value="">Select your location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-slate-500" />
                  PIN Code
                </span>
              </label>
              <input
                type="password"
                id="pin"
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter PIN"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-center text-2xl tracking-widest"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4 || !selectedLocation}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Contact your administrator if you need assistance accessing your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
