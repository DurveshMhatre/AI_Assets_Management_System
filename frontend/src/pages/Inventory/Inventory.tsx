import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, AlertTriangle, Package, Search, Plus, Pencil, Trash2, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

const EMPTY_FORM = {
    name: '', sku: '', categoryId: '', quantity: 0,
    minStockLevel: 0, maxStockLevel: 100, unitPrice: 0, notes: '',
};

export default function Inventory() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'records' | 'items'>('items');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [stockModal, setStockModal] = useState<{ item: any; type: 'in' | 'out' } | null>(null);
    const [stockQty, setStockQty] = useState(1);
    const [stockReason, setStockReason] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // ── Records tab state (Fix 2) ────────────────────────────────────────
    const [addAssetModal, setAddAssetModal] = useState(false);
    const [addAssetId, setAddAssetId] = useState('');
    const [addBranchId, setAddBranchId] = useState('');
    const [addQuantity, setAddQuantity] = useState(1);
    const [adjustModal, setAdjustModal] = useState<{ record: any } | null>(null);
    const [adjustQty, setAdjustQty] = useState(0);
    const [adjustNotes, setAdjustNotes] = useState('');
    const [removeRecordConfirm, setRemoveRecordConfirm] = useState<string | null>(null);

    // Legacy asset-linked inventory
    const { data: legacyData, isLoading: legacyLoading } = useQuery({
        queryKey: ['inventory'],
        queryFn: () => api.get('/inventory').then(r => r.data),
        enabled: activeTab === 'records',
    });

    // New inventory items
    const { data: itemsData, isLoading: itemsLoading } = useQuery({
        queryKey: ['inventory-items'],
        queryFn: () => api.get('/inventory/items').then(r => r.data),
        enabled: activeTab === 'items',
    });

    // Categories
    const { data: catsData } = useQuery({
        queryKey: ['inventory-categories'],
        queryFn: () => api.get('/inventory/categories').then(r => r.data.data),
    });

    // Assets list (for Add Asset to Inventory modal)
    const { data: assetsData } = useQuery({
        queryKey: ['assets-for-inventory'],
        queryFn: () => api.get('/assets?limit=200').then(r => r.data.data),
        enabled: addAssetModal,
    });

    // Branches list (for Add Asset to Inventory modal)
    const { data: branchesData } = useQuery({
        queryKey: ['branches-for-inventory'],
        queryFn: () => api.get('/settings/branches').then(r => r.data.data || []),
        enabled: addAssetModal,
    });

    // ── Items tab mutations ──────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: (data: any) => editing
            ? api.put(`/inventory/items/${editing.id}`, data)
            : api.post('/inventory/items', data),
        onSuccess: () => {
            toast.success('Saved!');
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            setShowForm(false); setEditing(null);
        },
        onError: () => toast.error('Save failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/inventory/items/${id}`),
        onSuccess: () => {
            toast.success('Deleted');
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            setDeleteConfirm(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
    });

    const stockMutation = useMutation({
        mutationFn: ({ id, type, quantity, reason }: any) =>
            api.post(`/inventory/items/${id}/stock-${type}`, { quantity, reason }),
        onSuccess: () => {
            toast.success('Stock updated!');
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            setStockModal(null); setStockQty(1); setStockReason('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Stock operation failed'),
    });

    // ── Records tab mutations (Fix 2) ────────────────────────────────────
    const addToInventoryMutation = useMutation({
        mutationFn: ({ assetId, branchId, quantity }: any) =>
            api.post('/inventory/records', { assetId, branchId, quantity }),
        onSuccess: () => {
            toast.success('Asset added to inventory!');
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            setAddAssetModal(false);
            setAddAssetId(''); setAddBranchId(''); setAddQuantity(1);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add'),
    });

    const adjustMutation = useMutation({
        mutationFn: ({ id, quantity, notes }: any) =>
            api.put(`/inventory/${id}/adjust`, { quantity, notes }),
        onSuccess: () => {
            toast.success('Stock updated!');
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            setAdjustModal(null);
        },
        onError: () => toast.error('Adjust failed'),
    });

    const removeFromInventoryMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/inventory/records/${id}`),
        onSuccess: () => {
            toast.success('Removed from inventory');
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            setRemoveRecordConfirm(null);
        },
        onError: () => toast.error('Remove failed'),
    });

    // ── Items tab handlers ───────────────────────────────────────────────
    const openNew = () => {
        setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true);
    };
    const openEdit = (item: any) => {
        setEditing(item);
        setForm({
            name: item.name, sku: item.sku || '', categoryId: item.categoryId || '',
            quantity: item.quantity, minStockLevel: item.minStockLevel,
            maxStockLevel: item.maxStockLevel, unitPrice: item.unitPrice, notes: item.notes || '',
        });
        setShowForm(true);
    };

    // Data for display
    const records = legacyData?.data || [];
    const legacySummary = legacyData?.summary || {};
    const items = itemsData?.data || [];
    const itemsSummary = itemsData?.summary || {};

    const filteredLegacy = records.filter((r: any) =>
        !search || r.asset?.name?.toLowerCase().includes(search.toLowerCase()) || r.asset?.assetCode?.toLowerCase().includes(search.toLowerCase())
    );
    const filteredItems = items.filter((i: any) =>
        !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase())
    );

    const summary = activeTab === 'items' ? itemsSummary : legacySummary;
    const summaryCards = activeTab === 'items' ? [
        { label: 'Total Items', value: summary.totalItems || 0, icon: Package, color: 'from-indigo-500 to-blue-600' },
        { label: 'Total Value', value: `₹${(summary.totalValue || 0).toLocaleString()}`, icon: Boxes, color: 'from-emerald-500 to-teal-600' },
        { label: 'Low Stock', value: summary.lowStock || 0, icon: AlertTriangle, color: 'from-amber-500 to-orange-600' },
        { label: 'Out of Stock', value: summary.outOfStock || 0, icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
    ] : [
        { label: 'Total SKUs', value: summary.totalSkus || 0, icon: Package, color: 'from-indigo-500 to-blue-600' },
        { label: 'Total Stock', value: summary.totalStockValue || 0, icon: Boxes, color: 'from-emerald-500 to-teal-600' },
        { label: 'Low Stock', value: summary.lowStock || 0, icon: AlertTriangle, color: 'from-amber-500 to-orange-600' },
        { label: 'Out of Stock', value: summary.outOfStock || 0, icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Track stock levels across locations</p>
                </div>
                {activeTab === 'items' && (
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                )}
                {activeTab === 'records' && (
                    <button onClick={() => setAddAssetModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                        <Plus className="w-4 h-4" /> Add Asset to Inventory
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {([
                    { key: 'items' as const, label: 'Inventory Items' },
                    { key: 'records' as const, label: 'Asset Records' },
                ]).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                            ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryCards.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-slate-500">{c.label}</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                                <c.icon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="relative w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
            </div>

            {/* Items Table */}
            {activeTab === 'items' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Min / Max</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Unit Price</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {itemsLoading ? Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                            )) : filteredItems.length === 0 ? (
                                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    No inventory items yet
                                </td></tr>
                            ) : filteredItems.map((item: any) => {
                                const isLow = item.quantity > 0 && item.quantity <= item.minStockLevel;
                                const isOut = item.quantity === 0;
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-medium text-slate-800">{item.name}</p>
                                            {item.sku && <p className="text-xs text-slate-400 font-mono">{item.sku}</p>}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{item.category?.name || '—'}</td>
                                        <td className={`px-5 py-3 text-center text-sm font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                                            {item.quantity}
                                        </td>
                                        <td className="px-5 py-3 text-center text-sm text-slate-500">{item.minStockLevel} / {item.maxStockLevel}</td>
                                        <td className="px-5 py-3 text-right text-sm text-slate-600">₹{item.unitPrice.toLocaleString()}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setStockModal({ item, type: 'in' })}
                                                    className="p-1.5 rounded-lg hover:bg-emerald-50" title="Stock In">
                                                    <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                                                </button>
                                                <button onClick={() => setStockModal({ item, type: 'out' })}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50" title="Stock Out">
                                                    <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                                                </button>
                                                <button onClick={() => openEdit(item)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                                </button>
                                                <button onClick={() => setDeleteConfirm(item.id)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Legacy Asset Records Table (Fix 2: add action column) */}
            {activeTab === 'records' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Branch</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Min</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Max</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last Audit</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {legacyLoading ? Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                            )) : filteredLegacy.length === 0 ? (
                                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    No asset records in inventory. Click "Add Asset to Inventory" to get started.
                                </td></tr>
                            ) : filteredLegacy.map((r: any) => {
                                const isLow = r.quantity <= r.minStockLevel;
                                const isOut = r.quantity === 0;
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-medium text-slate-800">{r.asset?.name}</p>
                                            <p className="text-xs text-slate-400 font-mono">{r.asset?.assetCode}</p>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{r.branch?.name}</td>
                                        <td className={`px-5 py-3 text-center text-sm font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>{r.quantity}</td>
                                        <td className="px-5 py-3 text-center text-sm text-slate-500">{r.minStockLevel}</td>
                                        <td className="px-5 py-3 text-center text-sm text-slate-500">{r.maxStockLevel}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-500">
                                            {r.lastAuditDate ? new Date(r.lastAuditDate).toLocaleDateString('en-IN') : '—'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => { setAdjustModal({ record: r }); setAdjustQty(r.quantity); setAdjustNotes(''); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                    title="Adjust stock"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setRemoveRecordConfirm(r.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    title="Remove from inventory"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══════ ITEMS TAB MODALS ═══════ */}

            {/* Add/Edit Item Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">{editing ? 'Edit' : 'New'} Inventory Item</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option value="">— None —</option>
                                    {(catsData || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                                    <input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Min</label>
                                    <input type="number" min={0} value={form.minStockLevel} onChange={e => setForm({ ...form, minStockLevel: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Max</label>
                                    <input type="number" min={0} value={form.maxStockLevel} onChange={e => setForm({ ...form, maxStockLevel: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit Price (₹)</label>
                                <input type="number" min={0} step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-16 resize-none" /></div>
                            <button type="submit" disabled={saveMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md">
                                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock In/Out Modal */}
            {stockModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <h2 className="text-lg font-bold mb-1">
                            {stockModal.type === 'in' ? '📦 Stock In' : '📤 Stock Out'}
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">{stockModal.item.name} (Current: {stockModal.item.quantity})</p>
                        <div className="space-y-3">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                                <input type="number" min={1} value={stockQty} onChange={e => setStockQty(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                                <input value={stockReason} onChange={e => setStockReason(e.target.value)} placeholder="Optional reason"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setStockModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button onClick={() => stockMutation.mutate({
                                id: stockModal.item.id, type: stockModal.type, quantity: stockQty, reason: stockReason
                            })} className={`flex-1 py-2 text-white rounded-lg text-sm font-medium ${stockModal.type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                                {stockMutation.isPending ? 'Processing...' : stockModal.type === 'in' ? 'Stock In' : 'Stock Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Item Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <h2 className="text-lg font-bold mb-2">Delete Item?</h2>
                        <p className="text-sm text-slate-500 mb-4">This will permanently remove the item and all transaction history.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button onClick={() => deleteMutation.mutate(deleteConfirm)}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ RECORDS TAB MODALS (Fix 2) ═══════ */}

            {/* Add Asset to Inventory Modal */}
            {addAssetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-slate-900">Add Asset to Inventory</h2>
                            <button onClick={() => setAddAssetModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Asset *</label>
                                <select value={addAssetId} onChange={e => setAddAssetId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none">
                                    <option value="">— Select Asset —</option>
                                    {(assetsData || []).map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                                <select value={addBranchId} onChange={e => setAddBranchId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none">
                                    <option value="">— Select Branch —</option>
                                    {(branchesData || []).map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Quantity</label>
                                <input type="number" min={1} value={addQuantity} onChange={e => setAddQuantity(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <button
                                onClick={() => {
                                    if (!addAssetId || !addBranchId) return toast.error('Please select an asset and branch');
                                    addToInventoryMutation.mutate({ assetId: addAssetId, branchId: addBranchId, quantity: addQuantity });
                                }}
                                disabled={addToInventoryMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {addToInventoryMutation.isPending ? 'Adding...' : 'Add to Inventory'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjust Stock Modal */}
            {adjustModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-slate-900">Adjust Stock — {adjustModal.record.asset?.name}</h2>
                            <button onClick={() => setAdjustModal(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">New Quantity</label>
                                <input type="number" min={0} value={adjustQty}
                                    onChange={e => setAdjustQty(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
                                <input type="text" value={adjustNotes}
                                    onChange={e => setAdjustNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    placeholder="Reason for adjustment..." />
                            </div>
                            <button
                                onClick={() => adjustMutation.mutate({ id: adjustModal.record.id, quantity: adjustQty, notes: adjustNotes })}
                                disabled={adjustMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {adjustMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Record Confirm Modal */}
            {removeRecordConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4 text-center">
                        <p className="text-slate-700 font-medium mb-2">Remove this asset from inventory records?</p>
                        <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setRemoveRecordConfirm(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button
                                onClick={() => removeFromInventoryMutation.mutate(removeRecordConfirm)}
                                disabled={removeFromInventoryMutation.isPending}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {removeFromInventoryMutation.isPending ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
