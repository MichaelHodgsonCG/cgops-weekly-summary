import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Role {
  id: string;
  name: string;
  count: number;
}

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRole, setNewRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);

      const { data: rolesData, error: rolesError } = await supabase
        .from('weekly_summary_roles')
        .select('*')
        .order('name');

      if (rolesError) throw rolesError;

      const { data: usersData, error: usersError } = await supabase
        .from('weekly_summary_users')
        .select('role');

      if (usersError) throw usersError;

      const roleCounts = usersData.reduce((acc: Record<string, number>, user) => {
        if (user.role) {
          acc[user.role] = (acc[user.role] || 0) + 1;
        }
        return acc;
      }, {});

      const rolesWithCounts = (rolesData || []).map(role => ({
        id: role.id,
        name: role.name,
        count: roleCounts[role.name] || 0
      }));

      setRoles(rolesWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;

    const roleExists = roles.some(r => r.name.toLowerCase() === newRole.trim().toLowerCase());
    if (roleExists) {
      setError('Role already exists');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('weekly_summary_roles')
        .insert({ name: newRole.trim() })
        .select()
        .single();

      if (error) throw error;

      setRoles([...roles, { id: data.id, name: data.name, count: 0 }]);
      setNewRole('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add role');
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to remove the "${roleName}" role? This will unassign it from all users.`)) {
      return;
    }

    try {
      await supabase
        .from('weekly_summary_users')
        .update({ role: null })
        .eq('role', roleName);

      const { error } = await supabase
        .from('weekly_summary_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setRoles(roles.filter(r => r.id !== roleId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Roles Management</h2>
          <p className="text-slate-600 mt-1">Manage user roles and permissions</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleAddRole} className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Enter new role name..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Role
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Role Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Users Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No roles found. Add your first role above.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Shield className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">{role.count} {role.count === 1 ? 'user' : 'users'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
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
