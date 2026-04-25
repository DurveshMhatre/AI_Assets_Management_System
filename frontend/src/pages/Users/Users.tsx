import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, Plus, Pencil, Trash2, X, Shield, ShieldCheck, Eye, Wrench, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

const LEGACY_ROLES = [
    { value: 'ADMIN', label: 'Admin', icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
    { value: 'MANAGER', label: 'Manager', icon: Shield, color: 'bg-amber-100 text-amber-700' },
    { value: 'TECHNICIAN', label: 'Technician', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
    { value: 'VIEWER', label: 'Viewer', icon: Eye, color: 'bg-slate-100 text-slate-600' },
];

const EMPTY_FORM = {
    name: '', email: '', password: '', role: 'VIEWER', isActive: true,
};

export default function Users() {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const hasPermission = useAuthStore((s) => s.hasPermission);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [roleChangeUser, setRoleChangeUser] = useState<any>(null);
    const [selectedRoleId, setSelectedRoleId] = useState('');

    if (!hasPermission('MANAGE_USERS')) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-slate-500">Access denied. Insufficient permissions.</p>
            </div>
        );
    }

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('/users').then(r => r.data.data),
    });

    // Fetch DB roles for the "Change Role" modal
    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then(r => r.data.data),
    });
    const dbRoles = rolesData?.roles || [];

    const saveMutation = useMutation({
        mutationFn: (data: any) => editing
            ? api.put(`/users/${editing.id}`, data)
            : api.post('/users', data),
        onSuccess: () => {
            toast.success(editing ? 'User updated!' : 'User created!');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowForm(false); setEditing(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => {
            toast.success('User deleted');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setDeleteConfirm(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            api.put(`/users/${id}`, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const changeRoleMutation = useMutation({
        mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
            api.put(`/users/${userId}/role`, { roleId }),
        onSuccess: () => {
            toast.success('Role updated!');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setRoleChangeUser(null);
            setSelectedRoleId('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Role change failed'),
    });

    const openNew = () => {
        setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true);
    };
    const openEdit = (u: any) => {
        setEditing(u);
        setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive });
        setShowForm(true);
    };

    const openRoleChange = (u: any) => {
        setRoleChangeUser(u);
        setSelectedRoleId(u.roleId || '');
    };

    const getRoleBadge = (role: string) => {
        const r = LEGACY_ROLES.find(x => x.value === role) || LEGACY_ROLES[3];
        const Icon = r.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${r.color}`}>
                <Icon className="w-3 h-3" /> {r.label}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage system users and their roles</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: users?.length || 0, color: 'from-indigo-500 to-blue-600' },
                    { label: 'Active', value: users?.filter((u: any) => u.isActive).length || 0, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Admins', value: users?.filter((u: any) => u.role === 'ADMIN').length || 0, color: 'from-red-500 to-rose-600' },
                    { label: 'Inactive', value: users?.filter((u: any) => !u.isActive).length || 0, color: 'from-slate-400 to-slate-500' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last Login</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : (users || []).map((u: any) => (
                            <tr key={u.id} className={`hover:bg-slate-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                            <span className="text-sm font-bold text-indigo-600">
                                                {u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{u.name}</p>
                                            <p className="text-xs text-slate-400">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        {getRoleBadge(u.role)}
                                        {u.id !== currentUser?.id && (
                                            <button
                                                onClick={() => openRoleChange(u)}
                                                className="p-1 rounded-lg hover:bg-indigo-50 transition-colors"
                                                title="Change role"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-center">
                                    <button
                                        onClick={() => {
                                            if (u.id === currentUser?.id) return;
                                            toggleMutation.mutate({ id: u.id, isActive: !u.isActive });
                                        }}
                                        disabled={u.id === currentUser?.id}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                            u.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        } ${u.id === currentUser?.id ? 'cursor-not-allowed' : ''}`}
                                    >
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-500">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => openEdit(u)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                        </button>
                                        {u.id !== currentUser?.id && (
                                            <button onClick={() => setDeleteConfirm(u.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit User Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">{editing ? 'Edit' : 'New'} User</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">
                                {editing ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    {...(!editing ? { required: true } : {})} minLength={6}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    {LEGACY_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select></div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isActive" checked={form.isActive}
                                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                    className="rounded border-slate-300" />
                                <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
                            </div>
                            <button type="submit" disabled={saveMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md">
                                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Role Modal */}
            {roleChangeUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">Change Role</h2>
                            <button onClick={() => setRoleChangeUser(null)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Assign a new role to <span className="font-semibold text-slate-700">{roleChangeUser.name}</span>
                        </p>
                        <div className="space-y-2 mb-5">
                            {dbRoles.map((role: any) => (
                                <label
                                    key={role.id}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                        selectedRoleId === role.id
                                            ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200'
                                            : 'border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="roleSelect"
                                        value={role.id}
                                        checked={selectedRoleId === role.id}
                                        onChange={() => setSelectedRoleId(role.id)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{role.name}</p>
                                        {role.description && <p className="text-xs text-slate-400">{role.description}</p>}
                                        <p className="text-xs text-slate-400 mt-0.5">{role.permissions?.length || 0} permissions</p>
                                    </div>
                                </label>
                            ))}
                            {dbRoles.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-4">No roles found. Create roles first.</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setRoleChangeUser(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button
                                onClick={() => {
                                    if (!selectedRoleId) return toast.error('Please select a role');
                                    changeRoleMutation.mutate({ userId: roleChangeUser.id, roleId: selectedRoleId });
                                }}
                                disabled={!selectedRoleId || changeRoleMutation.isPending}
                                className="flex-1 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {changeRoleMutation.isPending ? 'Saving...' : 'Assign Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <h2 className="text-lg font-bold mb-2">Delete User?</h2>
                        <p className="text-sm text-slate-500 mb-4">This will permanently remove this user account.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button onClick={() => deleteMutation.mutate(deleteConfirm)}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
