import React, { useState } from 'react';
import { Settings, Users, MapPin, LogOut, Shield, ChefHat, Calendar, Lock, DollarSign } from 'lucide-react';
import { UsersManager } from './UsersManager';
import LocationsManager from './LocationsManager';
import { RolesManager } from './RolesManager';
import { ChefSummariesManager } from './ChefSummariesManager';
import FiscalCalendarManager from './FiscalCalendarManager';
import PermissionsManager from './PermissionsManager';
import { PLAdjustments } from './PLAdjustments';
import { useAuth } from '../lib/auth';

interface AdminMenuProps {
  onClose: () => void;
}

export function AdminMenu({ onClose }: AdminMenuProps) {
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'users' | 'locations' | 'roles' | 'permissions' | 'chef-summaries' | 'fiscal-calendar' | 'pl-adjustments'>('users');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    onClose();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <div className="md:w-64 bg-white border-b md:border-r md:border-b-0 border-slate-200 flex flex-col">
        <div className="p-4 md:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Admin Panel</h2>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 p-4 space-y-2 ${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
          <button
            onClick={() => setActiveSection('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'users'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Users</span>
          </button>
          <button
            onClick={() => setActiveSection('locations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'locations'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="font-medium">Locations</span>
          </button>
          <button
            onClick={() => setActiveSection('roles')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'roles'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="font-medium">Roles</span>
          </button>
          <button
            onClick={() => setActiveSection('permissions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'permissions'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-5 h-5" />
            <span className="font-medium">Permissions</span>
          </button>
          <button
            onClick={() => setActiveSection('chef-summaries')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'chef-summaries'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ChefHat className="w-5 h-5" />
            <span className="font-medium">Chef Summaries</span>
          </button>
          <button
            onClick={() => setActiveSection('fiscal-calendar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'fiscal-calendar'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Fiscal Calendar</span>
          </button>
          <button
            onClick={() => setActiveSection('pl-adjustments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'pl-adjustments'
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">P&L Adjustments</span>
          </button>
        </nav>

        <div className={`p-4 border-t border-slate-200 ${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {activeSection === 'users' && <UsersManager />}
          {activeSection === 'locations' && <LocationsManager />}
          {activeSection === 'roles' && <RolesManager />}
          {activeSection === 'permissions' && <PermissionsManager />}
          {activeSection === 'chef-summaries' && <ChefSummariesManager />}
          {activeSection === 'fiscal-calendar' && <FiscalCalendarManager />}
          {activeSection === 'pl-adjustments' && <PLAdjustments />}
        </div>
      </div>
    </div>
  );
}
