import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Award, Globe, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState, useCallback } from 'react';

export default function Brands() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ name: '', website: '', description: '' });
    const [dupWarning, setDupWarning] = useState<{ exists: boolean; canonical?: { id: string; name: string } } | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['brands'],
        queryFn: () => api.get('/brands').then(r => r.data.data)
    });

    const saveMutation = useMutation({
        mutationFn: (data: any) => editing ? api.put(`/brands/${editing.id}`, data) : api.post('/brands', data),
        onSuccess: () => {
            toast.success('Saved!');
            queryClient.invalidateQueries({ queryKey: ['brands'] });
            setShowForm(false); setEditing(null); setDupWarning(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed')
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/brands/${id}`),
        onSuccess: () => { toast.success('Deleted!'); queryClient.invalidateQueries({ queryKey: ['brands'] }); },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed')
    });

    const checkDuplicate = useCallback(async (name: string) => {
        if (!name.trim()) { setDupWarning(null); return; }
        try {
            const params: any = { name: name.trim() };
            if (editing) params.excludeId = editing.id;
            const res = await api.get('/brands/check-duplicate', { params });
            setDupWarning(res.data);
        } catch { setDupWarning(null); }
    }, [editing]);

    const openEdit = (b: any) => {
        setEditing(b);
        setForm({ name: b.name, website: b.website || '', description: b.description || '' });
        setDupWarning(null);
        setShowForm(true);
    };
    const openNew = () => {
        setEditing(null);
        setForm({ name: '', website: '', description: '' });
        setDupWarning(null);
        setShowForm(true);
    };

    const isDuplicate = dupWarning?.exists === true;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold text-slate-900">Brands</h1><p className="text-slate-500 text-sm">Manage asset brands</p></div>
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                    <Plus className="w-4 h-4" /> Add Brand
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border animate-pulse h-28"></div>
                )) : (data || []).filter((b: any, i: number, arr: any[]) => arr.findIndex(x => x.id === b.id) === i).map((b: any) => (
                    <div key={b.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                <Award className="w-5 h-5 text-violet-600" />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                                <button onClick={() => deleteMutation.mutate(b.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-slate-800">{b.name}</h3>
                        {b.website && (
                            <a href={b.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 mt-1">
                                <Globe className="w-3 h-3" /> {b.website.replace('https://', '')}
                            </a>
                        )}
                        <p className="text-xs text-slate-400 mt-2">{b._count?.assets || 0} assets</p>
                    </div>
                ))}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">{editing ? 'Edit' : 'New'} Brand</h2>
                            <button onClick={() => { setShowForm(false); setDupWarning(null); }} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); if (!isDuplicate) saveMutation.mutate(form); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    onBlur={() => checkDuplicate(form.name)}
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:outline-none ${
                                        isDuplicate ? 'border-amber-400 focus:ring-amber-500/30' : 'border-slate-200 focus:ring-indigo-500/30'
                                    }`}
                                />
                                {isDuplicate && dupWarning?.canonical && (
                                    <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <p className="text-amber-700">
                                                A brand named <span className="font-semibold">"{dupWarning.canonical.name}"</span> already exists.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowForm(false);
                                                    setDupWarning(null);
                                                    toast.success(`Use existing brand "${dupWarning.canonical!.name}"`);
                                                }}
                                                className="mt-1 text-amber-600 font-medium hover:text-amber-700 underline text-xs"
                                            >
                                                Use existing entry instead
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" rows={2} /></div>
                            <button
                                type="submit"
                                disabled={isDuplicate}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
