import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Pencil, Trash2, X, Check, XCircle, Clock, ChevronDown } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

const STATUS_COLORS: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending_review: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, typeof Check> = {
    approved: Check,
    pending_review: Clock,
    rejected: XCircle,
};

const METHOD_LABELS: Record<string, string> = {
    STRAIGHT_LINE: 'SLM',
    DECLINING_BALANCE: 'WDV',
    SUM_OF_YEARS_DIGITS: 'SYD',
};

export default function AssetTypes() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const isApprover = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [form, setForm] = useState({
        name: '', description: '', depreciationMethod: 'STRAIGHT_LINE',
        usefulLifeYears: 5, salvageValuePercent: 10,
    });

    const { data, isLoading } = useQuery({
        queryKey: ['asset-types'],
        queryFn: () => api.get('/asset-types').then(r => r.data.data)
    });

    const { data: pending } = useQuery({
        queryKey: ['asset-types-pending'],
        queryFn: () => api.get('/asset-types/pending').then(r => r.data.data),
        enabled: isApprover,
    });

    const saveMutation = useMutation({
        mutationFn: (data: any) => editing ? api.put(`/asset-types/${editing.id}`, data) : api.post('/asset-types', data),
        onSuccess: () => {
            toast.success('Saved!');
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            queryClient.invalidateQueries({ queryKey: ['asset-types-pending'] });
            setShowForm(false); setEditing(null);
        },
        onError: () => toast.error('Save failed')
    });

    const requestMutation = useMutation({
        mutationFn: (data: any) => api.post('/asset-types/request', data),
        onSuccess: () => {
            toast.success('Submitted for review!');
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            queryClient.invalidateQueries({ queryKey: ['asset-types-pending'] });
            setShowForm(false);
        },
        onError: () => toast.error('Request failed')
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => api.put(`/asset-types/${id}/approve`),
        onSuccess: () => {
            toast.success('Approved!');
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            queryClient.invalidateQueries({ queryKey: ['asset-types-pending'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            api.put(`/asset-types/${id}/reject`, { reason }),
        onSuccess: () => {
            toast.success('Rejected');
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            queryClient.invalidateQueries({ queryKey: ['asset-types-pending'] });
            setRejectId(null); setRejectReason('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/asset-types/${id}`),
        onSuccess: () => { toast.success('Deleted!'); queryClient.invalidateQueries({ queryKey: ['asset-types'] }); },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed')
    });

    const openEdit = (t: any) => {
        setEditing(t);
        setForm({
            name: t.name, description: t.description || '',
            depreciationMethod: t.depreciationMethod,
            usefulLifeYears: t.usefulLifeYears, salvageValuePercent: t.salvageValuePercent
        });
        setShowForm(true);
    };

    const openNew = () => {
        setEditing(null);
        setForm({ name: '', description: '', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 5, salvageValuePercent: 10 });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing || isApprover) {
            saveMutation.mutate(form);
        } else {
            requestMutation.mutate(form);
        }
    };

    // Calculated preview
    const previewRate = (() => {
        const { depreciationMethod: m, usefulLifeYears: l, salvageValuePercent: s } = form;
        if (l <= 0) return 0;
        if (m === 'STRAIGHT_LINE') return Math.round(((100 - s) / l) * 100) / 100;
        if (m === 'DECLINING_BALANCE') return Math.round((1 - Math.pow(s / 100, 1 / l)) * 10000) / 100;
        const syd = (l * (l + 1)) / 2;
        return Math.round((l / syd) * (100 - s) * 100) / 100;
    })();

    const displayData = activeTab === 'pending' ? (pending || []) : (data || []);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Asset Types</h1>
                    <p className="text-slate-500 text-sm">Configure depreciation methods and useful life</p>
                </div>
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                    <Plus className="w-4 h-4" /> {isApprover ? 'Add Type' : 'Request Type'}
                </button>
            </div>

            {/* Tabs for ADMIN/MANAGER */}
            {isApprover && (
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {([
                        { key: 'all' as const, label: 'All Types', count: data?.length || 0 },
                        { key: 'pending' as const, label: 'Pending Approval', count: pending?.length || 0 },
                    ]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border animate-pulse h-40"></div>
                )) : displayData.map((t: any) => {
                    const StatusIcon = STATUS_ICONS[t.status] || Check;
                    return (
                        <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                    <Tags className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Status badge */}
                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {t.status === 'pending_review' ? 'Pending' : t.status}
                                    </span>
                                    {t.status === 'approved' && (
                                        <>
                                            <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100">
                                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                            </button>
                                            <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <h3 className="font-semibold text-slate-800">{t.name}</h3>
                            <p className="text-xs text-slate-500 mt-1 mb-3">{t.description || 'No description'}</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                                    {METHOD_LABELS[t.depreciationMethod] || t.depreciationMethod}
                                </span>
                                <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-full">{t.usefulLifeYears}yr</span>
                                <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-full">{t.salvageValuePercent}% salvage</span>
                                {t.annualDepreciationRate && (
                                    <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full font-medium">
                                        {t.annualDepreciationRate}%/yr
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-slate-400">{t._count?.assets || 0} assets</p>
                                {t.createdBy && (
                                    <p className="text-xs text-slate-400">by {t.createdBy.name}</p>
                                )}
                            </div>

                            {/* Approve/Reject buttons for pending items */}
                            {isApprover && t.status === 'pending_review' && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                    <button
                                        onClick={() => approveMutation.mutate(t.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => setRejectId(t.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            )}

                            {/* Rejection reason */}
                            {t.status === 'rejected' && t.rejectionReason && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <p className="text-xs text-red-500">Reason: {t.rejectionReason}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">
                                {editing ? 'Edit' : isApprover ? 'New' : 'Request'} Asset Type
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Method</label>
                                <select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option value="STRAIGHT_LINE">Straight Line (SLM)</option>
                                    <option value="DECLINING_BALANCE">Written Down Value (WDV)</option>
                                    <option value="SUM_OF_YEARS_DIGITS">Sum of Years Digits (SYD)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Useful Life (years)</label>
                                    <input type="number" min={1} value={form.usefulLifeYears}
                                        onChange={e => setForm({ ...form, usefulLifeYears: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Salvage Value %</label>
                                    <input type="number" min={0} max={100} value={form.salvageValuePercent}
                                        onChange={e => setForm({ ...form, salvageValuePercent: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>

                            {/* Live depreciation rate preview */}
                            <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Calculated Annual Depreciation Rate</p>
                                <p className="text-lg font-bold text-indigo-700">{previewRate}% / year</p>
                            </div>

                            <button type="submit" disabled={saveMutation.isPending || requestMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md">
                                {saveMutation.isPending || requestMutation.isPending
                                    ? 'Saving...'
                                    : editing ? 'Update' : isApprover ? 'Create' : 'Submit for Review'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <h2 className="text-lg font-bold mb-4">Reject Reason</h2>
                        <textarea
                            value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Provide a reason for rejection..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-red-500/30 focus:outline-none"
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={() => rejectMutation.mutate({ id: rejectId, reason: rejectReason })}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
