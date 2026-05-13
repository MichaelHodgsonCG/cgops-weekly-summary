import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Trophy, TrendingUp, Menu, X, LogOut, Settings, User, Book } from 'lucide-react';
import Dashboard from './components/Dashboard';
import LocationDetail from './components/LocationDetail';
import UploadPage from './components/UploadPage';
import ComparisonView from './components/ComparisonView';
import RankingsView from './components/RankingsView';
import TrendsView from './components/TrendsView';
import PortfolioView from './components/PortfolioView';
import { LoginPage } from './components/LoginPage';
import { AdminMenu } from './components/AdminMenu';
import { LocationDashboard } from './components/LocationDashboard';
import { ChefSummaryDashboard } from './components/ChefSummaryDashboard';
import { ChefConsolidationView } from './components/ChefConsolidationView';
import UserSettings from './components/UserSettings';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';

type View = 'dashboard' | 'upload' | 'detail' | 'portfolio' | 'compare' | 'rankings' | 'trends' | 'admin' | 'settings' | 'chef-summary' | 'chef';


function AppContent() {
  const { user, logout, isAdmin, isHQ, isExecChef } = useAuth();
  const [view, setView] = useState<View>('portfolio');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isHQ || isExecChef) {
    return <LocationDashboard />;
  }

  if (!isAdmin) {
    return <LocationDashboard />;
  }

  useEffect(() => {
    loadAvailableWeeks();
  }, []);

  const loadAvailableWeeks = async () => {
    const { data, error } = await supabase
      .from('pl_uploads')
      .select('week_ending_date')
      .order('week_ending_date', { ascending: false });

    if (!error && data) {
      const uniqueWeeks = Array.from(new Set(data.map(d => d.week_ending_date)));
      setAvailableWeeks(uniqueWeeks);
      if (uniqueWeeks.length > 0) {
        setSelectedWeek(uniqueWeeks[0]);
      }
    }
  };

  const handleLocationClick = (locationId: string, weekEndingDate: string) => {
    setSelectedLocation(locationId);
    setSelectedWeek(weekEndingDate);
    setView('detail');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedLocation('');
    setSelectedWeek('');
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
    setMobileMenuOpen(false);
  };

  const navigationItems = [
    { id: 'portfolio' as View, label: 'Home', icon: BarChart3, mobile: true },
    { id: 'rankings' as View, label: 'Leaderboard', icon: Trophy, mobile: true },
    { id: 'dashboard' as View, label: 'P&L', icon: LayoutDashboard, mobile: true },
    { id: 'trends' as View, label: 'Trends', icon: TrendingUp, mobile: true },
    { id: 'chef' as View, label: 'Chef', icon: Book, mobile: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="hidden md:block bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-12">
              <h1 className="text-lg font-bold text-slate-800">Restaurant Analytics</h1>

              {user && (
                <div className="text-sm text-slate-600">
                  Welcome, <span className="font-medium">{user.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewChange('settings')}
                  className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                  title="Settings"
                >
                  <User className="w-4 h-4" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => handleViewChange('admin')}
                  className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                  title="Admin Panel"
                >
                  <Settings className="w-4 h-4" />
                  <span>Admin</span>
                </button>

                {view !== 'admin' && view !== 'settings' && (
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 md:h-14">
            <div className="flex items-center gap-3 md:hidden">
              <h1 className="text-base font-bold text-slate-800">Restaurant Analytics</h1>
              {user && (
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Welcome, {user.name}
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center justify-center gap-2 flex-1">
              {navigationItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleViewChange(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      view === item.id || (view === 'detail' && item.id === 'dashboard')
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-auto p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navigationItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleViewChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      view === item.id || (view === 'detail' && item.id === 'dashboard')
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={() => handleViewChange('settings')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <User className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={() => handleViewChange('admin')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Admin Panel
              </button>
              {view !== 'admin' && view !== 'settings' && (
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {view === 'portfolio' && selectedWeek && <PortfolioView weekEndingDate={selectedWeek} />}
        {view === 'compare' && selectedWeek && <ComparisonView weekEndingDate={selectedWeek} />}
        {view === 'rankings' && selectedWeek && <RankingsView weekEndingDate={selectedWeek} />}
        {view === 'trends' && selectedWeek && <TrendsView weekEndingDate={selectedWeek} />}
        {view === 'chef' && <ChefConsolidationView />}
        {view === 'chef-summary' && <ChefSummaryDashboard />}
        {view === 'dashboard' && (
          <Dashboard
            onLocationClick={handleLocationClick}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            availableWeeks={availableWeeks}
          />
        )}
        {view === 'upload' && <UploadPage />}
        {view === 'settings' && <UserSettings />}
        {view === 'admin' && <AdminMenu onClose={() => handleViewChange('rankings')} />}
        {view === 'detail' && (
          <LocationDetail
            locationId={selectedLocation}
            weekEndingDate={selectedWeek}
            onBack={handleBackToDashboard}
          />
        )}
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navigationItems.filter(item => item.mobile).map(item => {
            const Icon = item.icon;
            const isActive = view === item.id || (view === 'detail' && item.id === 'dashboard');
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, login } = useAuth();

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return <AppContent />;
}

export default App;
