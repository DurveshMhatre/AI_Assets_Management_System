import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Gavel, Pencil, Trash2, X } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function TenderTypes() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ name: '', description: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['tender-types'],
        queryFn: () => api.get('/tender-types').then(r => r.data.data)
    });

    const saveMutation = useMutation({
        mutationFn: (data: any) => editing
            ? api.put(`/tender-types/${editing.id}`, data)
            : api.post('/tender-types', data),
        onSuccess: () => {
            toast.success(editing ? 'Updated!' : 'Created!');
            queryClient.invalidateQueries({ queryKey: ['tender-types'] });
            setShowForm(false);
            setEditing(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed')
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/tender-types/${id}`),
        onSuccess: () => {
            toast.success('Deleted!');
            queryClient.invalidateQueries({ queryKey: ['tender-types'] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed')
    });

    const openEdit = (t: any) => {
        setEditing(t);
        setForm({ name: t.name, description: t.description || '' });
        setShowForm(true);
    };

    const openNew = () => {
        setEditing(null);
        setForm({ name: '', description: '' });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(form);
    };

    const PRESET_TYPES = [
        { name: 'Open Tender', desc: 'Public tender open to all qualified bidders' },
        { name: 'Limited Tender', desc: 'Tender restricted to pre-qualified or shortlisted vendors' },
        { name: 'Single Tender', desc: 'Direct procurement from a single source' },
        { name: 'Two-Stage Tender', desc: 'Technical evaluation followed by financial bid opening' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Tender Types</h1>
                    <p className="text-slate-500 text-sm">Manage procurement tender categories (Open, Limited, Single, etc.)</p>
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md"
                >
                    <Plus className="w-4 h-4" /> Add Tender Type
                </button>
            </div>

            {/* Quick add presets if empty */}
            {!isLoading && (!data || data.length === 0) && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                    <h3 className="font-semibold text-slate-800 mb-2">Quick Setup</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        No tender types configured yet. Add standard government procurement types with one click:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {PRESET_TYPES.map(preset => (
                            <button
                                key={preset.name}
                                onClick={() => saveMutation.mutate({ name: preset.name, description: preset.desc })}
                                className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                                + {preset.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border animate-pulse h-36"></div>
                )) : (data || []).map((t: any) => (
                    <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                <Gavel className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100">
                                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                                <button onClick={() => {
                                    if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id);
                                }} className="p-1.5 rounded-lg hover:bg-red-50">
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-slate-800">{t.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-3 line-clamp-2">{t.description || 'No description'}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">
                                {t._count?.tenders || 0} tenders
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">
                                {editing ? 'Edit' : 'New'} Tender Type
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                    placeholder="e.g. Open Tender"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Brief description of this tender type..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
