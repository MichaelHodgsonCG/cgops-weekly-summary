import { useState, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { supabase, Permission, RolePermission } from '../lib/supabase';

type Role = {
  id: string;
  name: string;
  created_at: string;
};

type PermissionsByCategory = {
  [category: string]: Permission[];
};

export default function PermissionsManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rolesResult, permissionsResult, rolePermissionsResult] = await Promise.all([
      supabase.from('weekly_summary_roles').select('*').order('name'),
      supabase.from('weekly_summary_permissions').select('*').order('category, name'),
      supabase.from('weekly_summary_role_permissions').select('*')
    ]);

    if (rolesResult.data) setRoles(rolesResult.data);
    if (permissionsResult.data) setPermissions(permissionsResult.data);
    if (rolePermissionsResult.data) setRolePermissions(rolePermissionsResult.data);

    if (rolesResult.data && rolesResult.data.length > 0 && !selectedRole) {
      setSelectedRole(rolesResult.data[0].id);
    }

    setLoading(false);
  };

  const hasPermission = (roleId: string, permissionId: string): boolean => {
    return rolePermissions.some(
      rp => rp.role_id === roleId && rp.permission_id === permissionId
    );
  };

  const togglePermission = async (roleId: string, permissionId: string) => {
    console.log('Toggle permission clicked:', { roleId, permissionId });
    setSaving(permissionId);
    setMessage(null);

    try {
      const existing = rolePermissions.find(
        rp => rp.role_id === roleId && rp.permission_id === permissionId
      );

      if (existing) {
        const { error } = await supabase
          .from('weekly_summary_role_permissions')
          .delete()
          .eq('id', existing.id);

        if (error) {
          console.error('Error removing permission:', error);
          setMessage({ type: 'error', text: `Failed to remove permission: ${error.message}` });
        } else {
          setMessage({ type: 'success', text: 'Permission removed' });
          await loadData();
        }
      } else {
        const { error } = await supabase
          .from('weekly_summary_role_permissions')
          .insert({ role_id: roleId, permission_id: permissionId });

        if (error) {
          console.error('Error adding permission:', error);
          setMessage({ type: 'error', text: `Failed to add permission: ${error.message}` });
        } else {
          setMessage({ type: 'success', text: 'Permission added' });
          await loadData();
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    }

    setSaving(null);
  };

  const groupPermissionsByCategory = (): PermissionsByCategory => {
    return permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as PermissionsByCategory);
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Reports': 'bg-blue-100 text-blue-800',
      'Data': 'bg-green-100 text-green-800',
      'Admin': 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading permissions...</div>
      </div>
    );
  }

  const permissionsByCategory = groupPermissionsByCategory();
  const selectedRoleObj = roles.find(r => r.id === selectedRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {message && (
          <div
            className={`rounded-lg p-4 mb-4 sticky top-4 z-10 shadow-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border-2 border-green-200'
                : 'bg-red-50 text-red-800 border-2 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="ml-4 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Manage Permissions
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Assign app sections and features to roles
            </p>
          </div>

          <div className="p-6">

            {roles.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p>No roles found. Please create roles first.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm text-slate-700">
                        <span className="font-semibold">Granted</span> - Permission is enabled
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <X className="w-5 h-5 text-red-600" />
                      </div>
                      <span className="text-sm text-slate-700">
                        <span className="font-semibold">Denied</span> - Permission is disabled
                      </span>
                    </div>
                  </div>
                </div>

                {selectedRoleObj && (
                  <div className="space-y-6">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">{category}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
                              {perms.filter(p => hasPermission(selectedRole, p.id)).length} / {perms.length}
                            </span>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-200">
                          {perms.map(permission => {
                            const isEnabled = hasPermission(selectedRole, permission.id);
                            const isSaving = saving === permission.id;

                            return (
                              <div
                                key={permission.id}
                                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-slate-800">{permission.name}</h4>
                                    <code className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                      {permission.code}
                                    </code>
                                  </div>
                                  <p className="text-sm text-slate-500 mt-1">{permission.description}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    console.log('Button clicked for permission:', permission.name);
                                    togglePermission(selectedRole, permission.id);
                                  }}
                                  disabled={isSaving}
                                  title={isEnabled ? 'Permission granted - Click to revoke' : 'Permission denied - Click to grant'}
                                  className={`ml-4 flex items-center justify-center w-12 h-12 rounded-lg transition-all font-semibold ${
                                    isSaving
                                      ? 'bg-slate-200 cursor-not-allowed'
                                      : isEnabled
                                      ? 'bg-green-500 text-white hover:bg-green-600 shadow-md'
                                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                                  }`}
                                >
                                  {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                  ) : isEnabled ? (
                                    <Check className="w-6 h-6" />
                                  ) : (
                                    <X className="w-6 h-6" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
