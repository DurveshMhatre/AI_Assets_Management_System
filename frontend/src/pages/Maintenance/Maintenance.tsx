import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Clock, CheckCircle, AlertTriangle, Plus, X } from 'lucide-react';
import api from '../../api/client';
import { useState } from 'react';
import toast from 'react-hot-toast';

const typeColors: Record<string, string> = {
    PREVENTIVE: 'bg-blue-100 text-blue-700',
    CORRECTIVE: 'bg-amber-100 text-amber-700',
    EMERGENCY: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, any> = {
    PENDING: { icon: Clock, color: 'text-amber-500' },
    IN_PROGRESS: { icon: Wrench, color: 'text-blue-500' },
    COMPLETED: { icon: CheckCircle, color: 'text-emerald-500' },
};

const EMPTY_FORM = {
    assetId: '',
    type: 'PREVENTIVE',
    scheduledDate: '',
    technician: '',
    description: '',
};

const EMPTY_COMPLETE = {
    actualCost: '',
    completionNotes: '',
    nextMaintenanceDate: '',
};

export default function Maintenance() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [assetSearch, setAssetSearch] = useState('');
    const [showComplete, setShowComplete] = useState<string | null>(null);
    const [completeForm, setCompleteForm] = useState({ ...EMPTY_COMPLETE });

    const { data, isLoading } = useQuery({
        queryKey: ['maintenance', filter],
        queryFn: () => api.get('/maintenance', { params: { status: filter || undefined } }).then(r => r.data)
    });

    const { data: assetsData } = useQuery({
        queryKey: ['assets-dropdown', assetSearch],
        queryFn: () => api.get('/assets', { params: { limit: 100, search: assetSearch || undefined } }).then(r => r.data.data),
        enabled: showForm,
    });

    const createMutation = useMutation({
        mutationFn: () => api.post('/maintenance', {
            assetId: form.assetId,
            type: form.type,
            scheduledDate: form.scheduledDate,
            description: form.description || undefined,
        }),
        onSuccess: () => {
            toast.success('Maintenance scheduled');
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to schedule maintenance'),
    });

    const completeMutation = useMutation({
        mutationFn: (id: string) => api.post(`/maintenance/${id}/complete`, {
            actualCost: completeForm.actualCost || undefined,
            completionNotes: completeForm.completionNotes || undefined,
            nextMaintenanceDate: completeForm.nextMaintenanceDate || undefined,
        }),
        onSuccess: () => {
            toast.success('Marked as completed');
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
            setShowComplete(null);
            setCompleteForm({ ...EMPTY_COMPLETE });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to complete'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/maintenance/${id}`),
        onSuccess: () => {
            toast.success('Deleted');
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Delete failed'),
    });

    const logs = data?.data || [];
    const counts = {
        all: logs.length,
        pending: logs.filter((l: any) => l.status === 'PENDING').length,
        inProgress: logs.filter((l: any) => l.status === 'IN_PROGRESS').length,
        completed: logs.filter((l: any) => l.status === 'COMPLETED').length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
                    <p className="text-slate-500 text-sm mt-1">Track and manage asset maintenance</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md shadow-indigo-500/25"
                >
                    <Plus className="w-4 h-4" /> Schedule Maintenance
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: counts.all, icon: Wrench, color: 'from-indigo-500 to-blue-600' },
                    { label: 'Pending', value: counts.pending, icon: Clock, color: 'from-amber-500 to-orange-600' },
                    { label: 'In Progress', value: counts.inProgress, icon: AlertTriangle, color: 'from-blue-500 to-cyan-600' },
                    { label: 'Completed', value: counts.completed, icon: CheckCircle, color: 'from-emerald-500 to-teal-600' },
                ].map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover">
                        <div className="flex items-start justify-between">
                            <div><p className="text-sm text-slate-500">{c.label}</p><p className="text-2xl font-bold mt-1">{c.value}</p></div>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}><c.icon className="w-5 h-5 text-white" /></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex gap-2">
                {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                        {f || 'All'}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Scheduled</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Cost</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : logs.length === 0 ? (
                            <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No maintenance records found</td></tr>
                        ) : logs.map((log: any) => {
                            const si = statusIcons[log.status] || statusIcons.PENDING;
                            const isOverdue = new Date(log.scheduledDate) < new Date() && log.status !== 'COMPLETED';
                            return (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-5 py-3">
                                        <p className="text-sm font-medium text-slate-800">{log.asset?.name}</p>
                                        <p className="text-xs text-slate-400 font-mono">{log.asset?.assetCode}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[log.type] || 'bg-slate-100 text-slate-600'}`}>{log.type}</span>
                                    </td>
                                    <td className="px-5 py-3 text-sm text-slate-600 max-w-[180px] truncate">{log.description || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-slate-600">{new Date(log.scheduledDate).toLocaleDateString('en-IN')}</td>
                                    <td className="px-5 py-3 text-sm font-medium text-slate-800 text-right">
                                        {log.cost > 0 ? `₹${log.cost.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <si.icon className={`w-4 h-4 ${si.color}`} />
                                            <span className="text-sm text-slate-600">{log.status.replace('_', ' ')}</span>
                                            {isOverdue && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 animate-pulse">OVERDUE</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {log.status !== 'COMPLETED' && (
                                                <button
                                                    onClick={() => { setShowComplete(log.id); setCompleteForm({ ...EMPTY_COMPLETE }); }}
                                                    className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                                                >
                                                    Complete
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { if (window.confirm('Delete this record?')) deleteMutation.mutate(log.id); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Schedule Maintenance Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-slate-900">Schedule Maintenance</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Asset <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Search assets…"
                                    value={assetSearch}
                                    onChange={e => setAssetSearch(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-1 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                                <select
                                    value={form.assetId}
                                    onChange={e => setForm({ ...form, assetId: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                >
                                    <option value="">Select asset…</option>
                                    {(assetsData || []).map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.name} — {a.assetCode || a.serialNumber || ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type <span className="text-red-500">*</span></label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                        <option value="PREVENTIVE">Preventive</option>
                                        <option value="CORRECTIVE">Corrective</option>
                                        <option value="EMERGENCY">Emergency</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date <span className="text-red-500">*</span></label>
                                    <input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <button type="submit" disabled={createMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm disabled:opacity-50">
                                {createMutation.isPending ? 'Scheduling…' : 'Schedule Maintenance'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark Complete Modal */}
            {showComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-slate-900">Mark as Completed</h2>
                            <button onClick={() => setShowComplete(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); completeMutation.mutate(showComplete!); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Actual Cost (₹)</label>
                                <input type="number" min="0" value={completeForm.actualCost} onChange={e => setCompleteForm({ ...completeForm, actualCost: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Completion Notes</label>
                                <textarea value={completeForm.completionNotes} onChange={e => setCompleteForm({ ...completeForm, completionNotes: e.target.value })} rows={3}
                                    placeholder="What was done, parts replaced, etc."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Next Maintenance Date</label>
                                <input type="date" value={completeForm.nextMaintenanceDate} onChange={e => setCompleteForm({ ...completeForm, nextMaintenanceDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowComplete(null)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={completeMutation.isPending}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium text-sm disabled:opacity-50">
                                    {completeMutation.isPending ? 'Saving…' : '✓ Mark Complete'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
