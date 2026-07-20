import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Trophy, TrendingUp, Menu, X, LogOut, Settings, User, Book, FileText, Upload, PanelLeft } from 'lucide-react';
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
import { UsageVarianceReport } from './components/UsageVarianceReport';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';

type View = 'dashboard' | 'upload' | 'detail' | 'portfolio' | 'compare' | 'rankings' | 'trends' | 'admin' | 'settings' | 'chef-summary' | 'chef' | 'guided-package' | 'variance-report';

// The boxed "CG" lockup — Georgia serif per the CGOPS brand (the only serif use).
function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center border-2 border-cg-text rounded flex-none"
      style={{ width: size, height: Math.round(size * 0.78), fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <span className="font-bold italic leading-none" style={{ fontSize: Math.round(size * 0.4), letterSpacing: '-0.5px' }}>CG</span>
    </span>
  );
}

const VIEW_TITLES: Record<string, string> = {
  portfolio: 'Home',
  rankings: 'Leaderboard',
  dashboard: 'P&L',
  detail: 'P&L',
  upload: 'Upload',
  trends: 'Trends',
  chef: 'Chef',
  'chef-summary': 'Chef',
  'variance-report': 'Variance',
  'guided-package': 'Guided Package',
  settings: 'Settings',
  admin: 'Admin',
  compare: 'Compare',
};

function AppContent() {
  const { user, logout, isAdmin, isHQ, isExecChef } = useAuth();
  const [view, setView] = useState<View>('portfolio');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Sidebar starts collapsed (icon rail); a button toggles it open — matches the
  // standard CGOPS shell.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const hasHQAccess = isAdmin || isHQ || isExecChef;

  useEffect(() => {
    if (hasHQAccess) {
      loadAvailableWeeks();
    }
  }, [hasHQAccess]);

  const loadAvailableWeeks = async () => {
    const { data, error } = await supabase
      .from('weekly_summary_pl_uploads')
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

  if (!hasHQAccess) {
    return <LocationDashboard />;
  }

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
    // Upload P&L is an admin-only function.
    ...(isAdmin ? [{ id: 'upload' as View, label: 'Upload', icon: Upload, mobile: false }] : []),
    { id: 'trends' as View, label: 'Trends', icon: TrendingUp, mobile: true },
    { id: 'chef' as View, label: 'Chef', icon: Book, mobile: true },
    { id: 'variance-report' as View, label: 'Variance', icon: FileText, mobile: false },
  ];

  const isItemActive = (id: View) => view === id || (view === 'detail' && id === 'dashboard');

  // A sidebar row (nav item or a bottom action). Collapsed = icon only + tooltip.
  const railRow = (
    key: string,
    label: string,
    Icon: typeof BarChart3,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      title={sidebarCollapsed ? label : undefined}
      className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-cg-accentSoft text-cg-accent' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5 flex-none" />
      {!sidebarCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const currentTitle = VIEW_TITLES[view] || 'Weekly Summary';

  return (
    <div className="min-h-screen bg-cg-bg flex">
      {/* Desktop left sidebar — collapsed icon rail by default, toggles open. */}
      <aside
        className="hidden md:flex flex-col bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen transition-[width] duration-200"
        style={{ width: sidebarCollapsed ? 64 : 240 }}
      >
        <div className={`h-16 flex items-center border-b border-slate-200 flex-none ${sidebarCollapsed ? 'justify-center' : 'gap-2 px-4'}`}>
          <BrandMark size={30} />
          {!sidebarCollapsed && <span className="font-bold text-sm text-cg-text truncate">Weekly Summary</span>}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
          {navigationItems.map(item => railRow(item.id, item.label, item.icon, isItemActive(item.id), () => handleViewChange(item.id)))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200 flex flex-col gap-1 flex-none">
          {railRow('settings', 'Settings', User, view === 'settings', () => handleViewChange('settings'))}
          {isAdmin && railRow('admin', 'Admin', Settings, view === 'admin', () => handleViewChange('admin'))}
          {railRow('signout', 'Sign Out', LogOut, false, logout)}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors`}
          >
            <PanelLeft className="w-5 h-5 flex-none" />
            {!sidebarCollapsed && <span className="truncate">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 h-16 md:h-14 flex items-center px-4 sm:px-6 gap-3">
          <div className="flex items-center gap-2 md:hidden">
            <BrandMark size={26} />
            <h1 className="text-base font-bold text-cg-text">Weekly Summary</h1>
          </div>

          <div className="hidden md:flex items-baseline gap-3">
            <span className="text-lg font-bold text-slate-900">{currentTitle}</span>
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400">CG Platform — Charcoal Group</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline text-sm text-slate-600">
                Welcome, <span className="font-medium">{user.name}</span>
              </span>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navigationItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleViewChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isItemActive(item.id)
                        ? 'bg-cg-accentSoft text-cg-accent'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={() => handleViewChange('settings')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <User className="w-5 h-5" />
                Settings
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleViewChange('admin')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  Admin Panel
                </button>
              )}
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1">
          {view === 'portfolio' && selectedWeek && <PortfolioView weekEndingDate={selectedWeek} />}
          {view === 'compare' && selectedWeek && <ComparisonView weekEndingDate={selectedWeek} />}
          {view === 'rankings' && selectedWeek && <RankingsView weekEndingDate={selectedWeek} />}
          {view === 'trends' && selectedWeek && <TrendsView weekEndingDate={selectedWeek} />}
          {view === 'chef' && <ChefConsolidationView />}
          {view === 'chef-summary' && <ChefSummaryDashboard />}
          {view === 'variance-report' && <UsageVarianceReport />}
          {view === 'dashboard' && (
            <Dashboard
              onLocationClick={handleLocationClick}
              selectedWeek={selectedWeek}
              setSelectedWeek={setSelectedWeek}
              availableWeeks={availableWeeks}
              onOpenBulkUpload={isAdmin ? () => handleViewChange('upload') : undefined}
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
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navigationItems.filter(item => item.mobile).map(item => {
            const Icon = item.icon;
            const isActive = isItemActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-cg-accentSoft text-cg-accent'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
