import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Download, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  name: string;
  restaurant: string | null;
  pin: string;
  role: string;
  created_at: string;
}

interface Location {
  name: string;
}

interface Role {
  name: string;
}

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', restaurant: '', pin: '', role: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResult, locationsResult, rolesResult] = await Promise.all([
        supabase.from('weekly_summary_users').select('*').order('created_at', { ascending: false }),
        supabase.from('locations').select('name').order('name'),
        supabase.from('weekly_summary_roles').select('name').order('name')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (locationsResult.error) throw locationsResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setUsers(usersResult.data || []);
      setLocations(locationsResult.data || []);
      setRoles(rolesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleAddUser = async () => {
    try {
      const { error } = await supabase.from('weekly_summary_users').insert([{
        name: formData.name || null,
        restaurant: formData.restaurant || null,
        pin: formData.pin,
        role: formData.role
      }]);

      if (error) throw error;

      await loadData();
      setShowAddForm(false);
      setFormData({ name: '', restaurant: '', pin: '', role: '' });
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user. Please try again.');
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const { error } = await supabase
        .from('weekly_summary_users')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      await loadData();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase.from('weekly_summary_users').delete().eq('id', userId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Restaurant', 'PIN', 'Role', 'Created At'];
    const rows = users.map(user => [
      user.name || '',
      user.restaurant || '',
      user.pin,
      user.role,
      new Date(user.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-slate-900">User Management</h3>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setShowAddForm(true);
              setFormData({ name: '', restaurant: '', pin: generatePin(), role: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cg-accent text-white rounded-lg hover:bg-cg-accentHover transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-300">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Add New User</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name (Optional)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                placeholder="Enter name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Restaurant <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.restaurant}
                onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
                required
              >
                <option value="">Select Restaurant</option>
                {locations.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                PIN <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent font-mono"
                  placeholder="6-digit PIN"
                  maxLength={6}
                  required
                />
                <button
                  onClick={() => setFormData({ ...formData, pin: generatePin() })}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                  title="Generate new PIN"
                >
                  <RefreshCw className="w-4 h-4 text-slate-700" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 focus:border-transparent"
              >
                <option value="">Select a role...</option>
                {roles.map(role => (
                  <option key={role.name} value={role.name}>{role.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({ name: '', restaurant: '', pin: '', role: '' });
              }}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddUser}
              disabled={!formData.pin || formData.pin.length !== 6 || !formData.restaurant}
              className="px-4 py-2 bg-cg-accent text-white rounded-lg hover:bg-cg-accentHover disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Add User
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Restaurant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                PIN
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      defaultValue={user.name || ''}
                      onBlur={(e) => handleUpdateUser(user.id, { name: e.target.value || null })}
                      className="px-2 py-1 border border-slate-300 rounded"
                    />
                  ) : (
                    <span className="text-sm text-slate-900">{user.name || '-'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <select
                      defaultValue={user.restaurant || ''}
                      onChange={(e) => handleUpdateUser(user.id, { restaurant: e.target.value || null })}
                      className="px-2 py-1 border border-slate-300 rounded"
                    >
                      <option value="">Select Restaurant</option>
                      {locations.map((loc) => (
                        <option key={loc.name} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-900 font-medium">{user.restaurant || '-'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={user.pin}
                        onBlur={(e) => {
                          const newPin = e.target.value.replace(/\D/g, '').slice(0, 6);
                          if (newPin.length === 6) {
                            handleUpdateUser(user.id, { pin: newPin });
                          } else {
                            alert('PIN must be exactly 6 digits');
                            e.target.value = user.pin;
                          }
                        }}
                        className="px-2 py-1 border border-slate-300 rounded font-mono w-24"
                        placeholder="6-digit"
                        maxLength={6}
                      />
                      <button
                        onClick={() => handleUpdateUser(user.id, { pin: generatePin() })}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                        title="Generate new PIN"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-slate-900 font-semibold">{user.pin}</span>
                      <button
                        onClick={() => handleUpdateUser(user.id, { pin: generatePin() })}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                        title="Generate new PIN"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <select
                      defaultValue={user.role || ''}
                      onChange={(e) => handleUpdateUser(user.id, { role: e.target.value || null })}
                      className="px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      <option value="">Select Role</option>
                      {roles.map((role) => (
                        <option key={role.name} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {user.role || 'No role'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                      className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                    >
                      {editingUser === user.id ? 'Done' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-slate-500">
          No users found. Add your first user to get started.
        </div>
      )}
    </div>
  );
}
