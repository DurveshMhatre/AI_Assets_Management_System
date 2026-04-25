import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Pencil, Trash2, X, Check, Users as UsersIcon } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { PERMISSION_CATEGORIES, ALL_PERMISSIONS } from '../../constants/permissions';

interface RoleData {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    userCount: number;
    permissions: { id: string; permission: string }[];
}

const roleColors: Record<string, string> = {
    ADMIN: 'from-indigo-500 to-purple-600',
    MANAGER: 'from-emerald-500 to-teal-600',
    TECHNICIAN: 'from-amber-500 to-orange-600',
    VIEWER: 'from-slate-400 to-slate-600',
};

export default function Roles() {
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newForm, setNewForm] = useState({ name: '', description: '' });
    const [editingRole, setEditingRole] = useState<RoleData | null>(null);
    const [editForm, setEditForm] = useState({ name: '', description: '' });
    const [permissionSet, setPermissionSet] = useState<Set<string>>(new Set());
    const [permDirty, setPermDirty] = useState(false);

    const { data: rolesData, isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then(r => r.data.data),
    });

    const roles: RoleData[] = rolesData?.roles || [];

    // When selecting a role, load its permissions into the checklist
    const selectRole = (role: RoleData) => {
        setSelectedRole(role);
        setPermissionSet(new Set(role.permissions.map(p => p.permission)));
        setPermDirty(false);
    };

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: { name: string; description: string }) =>
            api.post('/roles', data),
        onSuccess: () => {
            toast.success('Role created!');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setShowNewModal(false);
            setNewForm({ name: '', description: '' });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Create failed'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.put(`/roles/${id}`, data),
        onSuccess: () => {
            toast.success('Role updated!');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setEditingRole(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Update failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/roles/${id}`),
        onSuccess: () => {
            toast.success('Role deleted!');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            if (selectedRole?.id === deleteMutation.variables) setSelectedRole(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
    });

    const permMutation = useMutation({
        mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
            api.put(`/roles/${id}/permissions`, { permissions }),
        onSuccess: () => {
            toast.success('Permissions saved!');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setPermDirty(false);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed'),
    });

    const togglePermission = (perm: string) => {
        setPermissionSet(prev => {
            const next = new Set(prev);
            if (next.has(perm)) next.delete(perm);
            else next.add(perm);
            return next;
        });
        setPermDirty(true);
    };

    const savePermissions = () => {
        if (!selectedRole) return;
        permMutation.mutate({ id: selectedRole.id, permissions: Array.from(permissionSet) });
    };

    const openEdit = (role: RoleData, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingRole(role);
        setEditForm({ name: role.name, description: role.description || '' });
    };

    const getGradient = (name: string) =>
        roleColors[name] || 'from-blue-500 to-cyan-600';

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Roles & Access Control</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage roles and their permissions</p>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md"
                >
                    <Plus className="w-4 h-4" /> New Role
                </button>
            </div>

            {/* Two-panel layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left panel: Role list */}
                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border animate-pulse h-24" />
                        ))
                    ) : roles.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                            <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-slate-400 text-sm">No roles found</p>
                        </div>
                    ) : (
                        roles.map((role) => (
                            <div
                                key={role.id}
                                onClick={() => selectRole(role)}
                                className={`bg-white rounded-2xl p-5 shadow-sm border cursor-pointer transition-all duration-200 group ${
                                    selectedRole?.id === role.id
                                        ? 'border-indigo-300 ring-2 ring-indigo-100'
                                        : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradient(role.name)} flex items-center justify-center shadow-lg`}>
                                            <Shield className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{role.name}</h3>
                                            {role.description && (
                                                <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => openEdit(role, e)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100"
                                            title="Edit"
                                        >
                                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(role.id); }}
                                            disabled={role.isSystem || role.userCount > 0}
                                            className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={role.isSystem ? 'System role' : role.userCount > 0 ? 'Has assigned users' : 'Delete'}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <UsersIcon className="w-3 h-3" /> {role.userCount} users
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Check className="w-3 h-3" /> {role.permissions.length} permissions
                                    </span>
                                    {role.isSystem && (
                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-semibold">SYSTEM</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Right panel: Permission checklist */}
                <div className="lg:col-span-2">
                    {selectedRole ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {selectedRole.name} — Permissions
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Toggle permissions for this role. Changes are saved when you click Save.
                                    </p>
                                </div>
                                <button
                                    onClick={savePermissions}
                                    disabled={!permDirty || permMutation.isPending}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                                >
                                    {permMutation.isPending ? 'Saving...' : 'Save Permissions'}
                                </button>
                            </div>
                            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                                {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                                    <div key={key}>
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                            {category.label}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {category.permissions.map((perm) => {
                                                const checked = permissionSet.has(perm);
                                                return (
                                                    <label
                                                        key={perm}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                                            checked
                                                                ? 'border-indigo-200 bg-indigo-50/50'
                                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePermission(perm)}
                                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                                                        />
                                                        <span className="text-sm text-slate-700 font-medium">
                                                            {perm.replace(/_/g, ' ')}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-96">
                            <div className="text-center">
                                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                                <p className="text-slate-400 text-sm">Select a role to manage permissions</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Role Modal */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">Create New Role</h2>
                            <button onClick={() => setShowNewModal(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                createMutation.mutate(newForm);
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role Name *</label>
                                <input
                                    value={newForm.name}
                                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                                    required
                                    placeholder="e.g. AUDITOR"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={newForm.description}
                                    onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                                    placeholder="Optional description of role responsibilities..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none h-20 resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Role'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Role Modal */}
            {editingRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">Edit Role</h2>
                            <button onClick={() => setEditingRole(null)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                updateMutation.mutate({ id: editingRole.id, data: editForm });
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role Name</label>
                                <input
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none h-20 resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
