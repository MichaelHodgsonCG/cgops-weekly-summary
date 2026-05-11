import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { WeeklyChefSummary } from './WeeklyChefSummary';
import UserSettings from './UserSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface Location {
  id: string;
  name: string;
  code: string;
}

export function LocationDashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadUserLocation();
  }, [user]);

  const loadUserLocation = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('restaurant')
        .eq('id', user.id)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData?.restaurant) {
        setLoading(false);
        return;
      }

      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id, name, code')
        .eq('name', userData.restaurant)
        .maybeSingle();

      if (locationError) throw locationError;

      setLocation(locationData);
    } catch (error) {
      console.error('Error loading location:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-slate-600">Loading location...</div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Location Assigned</h2>
          <p className="text-slate-600">Please contact your administrator to assign a location to your account.</p>
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="min-h-screen">
        <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <h1 className="text-xl font-bold text-slate-900">{location.name}</h1>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
        <UserSettings />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900">{location.name}</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>
      </div>
      <WeeklyChefSummary locationId={location.id} locationName={location.name} />
    </div>
  );
}
