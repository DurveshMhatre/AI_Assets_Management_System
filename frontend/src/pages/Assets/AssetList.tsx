import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Download, Package, Grid3X3, List, ChevronDown, X, Pencil, Trash2, ChevronDown as SmallChevronDown } from 'lucide-react';
import api from '../../api/client';
import type { Asset } from '../../types';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    INACTIVE: 'bg-slate-100 text-slate-600',
    UNDER_MAINTENANCE: 'bg-amber-100 text-amber-700',
    DISPOSED: 'bg-red-100 text-red-700',
    LOST: 'bg-purple-100 text-purple-700',
};

export default function AssetList() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        serialNumber: '',
        status: 'ACTIVE',
        purchaseDate: '',
        purchasePrice: '',
        quantity: '1',
        warrantyExpiryDate: '',
        brandId: '',
        supplierId: '',
        assetTypeId: '',
        assignedToUserId: '',
        location: ''
    });

    const { data, isLoading } = useQuery({
        queryKey: ['assets', page, search, statusFilter],
        queryFn: () => api.get('/assets', { params: { page, limit: 20, search, status: statusFilter || undefined } }).then(r => r.data)
    });

    const { data: brandsData } = useQuery({
        queryKey: ['brands'],
        queryFn: () => api.get('/brands').then(r => r.data.data)
    });

    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => api.get('/suppliers').then(r => r.data.data)
    });

    const { data: typesData } = useQuery({
        queryKey: ['asset-types'],
        queryFn: () => api.get('/asset-types').then(r => r.data.data)
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('/users').then(r => r.data.data)
    });

    const assets: Asset[] = data?.data || [];
    const pagination = data?.pagination;

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            serialNumber: '',
            status: 'ACTIVE',
            purchaseDate: '',
            purchasePrice: '',
            quantity: '1',
            warrantyExpiryDate: '',
            brandId: '',
            supplierId: '',
            assetTypeId: '',
            assignedToUserId: '',
            location: ''
        });
        setEditing(null);
    };

    const saveAssetMutation = useMutation({
        mutationFn: () => {
            const payload: any = {
                name: form.name,
                description: form.description || undefined,
                serialNumber: form.serialNumber || undefined,
                status: form.status,
                purchaseDate: form.purchaseDate || undefined,
                purchasePrice: form.purchasePrice || '0',
                quantity: form.quantity || '1',
                warrantyExpiryDate: form.warrantyExpiryDate || undefined,
                brandId: form.brandId || undefined,
                supplierId: form.supplierId || undefined,
                assetTypeId: form.assetTypeId || undefined,
                assignedToUserId: form.assignedToUserId || undefined,
                location: form.location || undefined
            };
            if (editing) {
                return api.put(`/assets/${editing.id}`, payload);
            }
            return api.post('/assets', payload);
        },
        onSuccess: () => {
            toast.success(editing ? 'Asset updated' : 'Asset created');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setShowForm(false);
            resetForm();
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error || 'Save failed');
        }
    });

    const deleteAssetMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/assets/${id}`),
        onSuccess: () => {
            toast.success('Asset deleted');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Delete failed')
    });

    const handleEdit = (asset: Asset) => {
        setEditing(asset);
        setForm({
            name: asset.name || '',
            description: asset.description || '',
            serialNumber: asset.serialNumber || '',
            status: asset.status || 'ACTIVE',
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.substring(0, 10) : '',
            purchasePrice: String(asset.purchasePrice ?? ''),
            quantity: String(asset.quantity ?? '1'),
            warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.substring(0, 10) : '',
            brandId: asset.brandId || '',
            supplierId: asset.supplierId || '',
            assetTypeId: asset.assetTypeId || '',
            assignedToUserId: asset.assignedToUserId || '',
            location: asset.location || ''
        });
        setShowForm(true);
    };

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (!assets.length) return;
        const currentPageIds = assets.map(a => a.id);
        const allSelected = currentPageIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedIds.length) {
            toast.error('No assets selected');
            return;
        }
        if (!window.confirm(`Delete ${selectedIds.length} selected assets? This cannot be undone.`)) return;
        try {
            await api.post('/assets/bulk-delete', { ids: selectedIds });
            toast.success(`${selectedIds.length} assets deleted`);
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['assets'] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Bulk delete failed');
        }
    };

    const handleExport = async (format: 'xlsx' | 'pdf' | 'print' | 'pbix') => {
        setShowExportMenu(false);
        if (format === 'xlsx') {
            try {
                const res = await api.get('/reports/asset-register', {
                    params: { format: 'excel' },
                    responseType: 'blob'
                });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'asset-register.xlsx';
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Exported to Excel');
            } catch {
                toast.error('Export failed');
            }
            return;
        }
        if (format === 'pdf') {
            try {
                const res = await api.get('/reports/export/pdf', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Asset_Report.pdf';
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Exported to PDF');
            } catch {
                toast.error('PDF export failed');
            }
            return;
        }
        if (format === 'pbix') {
            try {
                const res = await api.get('/reports/export/powerbi', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'PowerBI_Asset_Data.xlsx';
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Exported for Power BI');
            } catch {
                toast.error('Power BI export failed');
            }
            return;
        }
        if (format === 'print') {
            window.print();
            return;
        }
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Assets</h1>
                    <p className="text-slate-500 text-sm">{pagination?.total || 0} assets in total</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md shadow-indigo-500/25"
                >
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, code, serial..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <Filter className="w-4 h-4" /> Filters <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                        <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                            <List className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowExportMenu(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                        >
                            <Download className="w-4 h-4" /> Export <SmallChevronDown className="w-3 h-3" />
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-slate-100 z-10">
                                <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    onClick={() => handleExport('xlsx')}
                                >
                                    Excel (.xlsx)
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    onClick={() => handleExport('pdf')}
                                >
                                    PDF (.pdf)
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    onClick={() => handleExport('print')}
                                >
                                    Print
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    onClick={() => handleExport('pbix')}
                                >
                                    Power BI (.pbix)
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {showFilters && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex gap-3 flex-wrap animate-fade-in">
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/30">
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                            <option value="DISPOSED">Disposed</option>
                            <option value="LOST">Lost</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 text-xs text-slate-600">
                        <span>{selectedIds.length} selected</span>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={!selectedIds.length}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-red-200 text-red-600 rounded-lg disabled:opacity-40 hover:bg-red-50"
                        >
                            <Trash2 className="w-3 h-3" /> Delete Selected
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-3 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={assets.length > 0 && assets.every(a => selectedIds.includes(a.id))}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Location</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Value</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan={6} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td>
                                        </tr>
                                    ))
                                ) : assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-3 py-3.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(asset.id)}
                                                onChange={() => toggleSelected(asset.id)}
                                            />
                                        </td>
                                        <td className="px-5 py-3.5 cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                                    <Package className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{asset.name}</p>
                                                    {asset.brand && <p className="text-xs text-slate-400">{asset.brand.name}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600 font-mono cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>{asset.assetCode}</td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600 cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>{asset.assetType?.name || '—'}</td>
                                        <td className="px-5 py-3.5 cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                                            <p className="text-sm font-medium text-slate-700">{(asset as any).branch?.name || (asset as any).location || '—'}</p>
                                            {(asset as any).branch?.city && (
                                                <p className="text-xs text-slate-400">{(asset as any).branch.city}</p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[asset.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {asset.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800 text-right">
                                            ₹{asset.currentValue.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => handleEdit(asset)}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-slate-100 mr-1"
                                            >
                                                <Pencil className="w-4 h-4 text-slate-500" />
                                            </button>
                                            <button
                                                onClick={() => deleteAssetMutation.mutate(asset.id)}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
                            </p>
                            <div className="flex gap-1">
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-slate-50">Prev</button>
                                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => i + 1).map(p => (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`px-3 py-1 text-sm rounded-lg ${p === page ? 'bg-indigo-600 text-white' : 'border hover:bg-slate-50'}`}>{p}</button>
                                ))}
                                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-slate-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {assets.map((asset) => (
                        <div key={asset.id} onClick={() => navigate(`/assets/${asset.id}`)}
                            className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer card-hover">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-indigo-600" />
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[asset.status]}`}>
                                    {asset.status.replace('_', ' ')}
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-800 mb-1 truncate">{asset.name}</h3>
                            <p className="text-xs text-slate-400 mb-3">{asset.assetCode} • {asset.brand?.name || '—'}</p>
                            <div className="flex justify-between items-center text-xs">
                                <div>
                                    <span className="text-slate-500">{(asset as any).branch?.name || (asset as any).location || '—'}</span>
                                    {(asset as any).branch?.city && (
                                        <span className="text-slate-400 block">{(asset as any).branch.city}</span>
                                    )}
                                </div>
                                <span className="font-semibold text-slate-800">₹{asset.currentValue.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Asset Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">{editing ? 'Edit Asset' : 'New Asset'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveAssetMutation.mutate();
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                                    <select
                                        value={form.brandId}
                                        onChange={e => setForm({ ...form, brandId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Select brand</option>
                                        {(brandsData || []).map((b: any) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type</label>
                                    <select
                                        value={form.assetTypeId}
                                        onChange={e => setForm({ ...form, assetTypeId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Select type</option>
                                        {(typesData || []).map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                                    <select
                                        value={form.supplierId}
                                        onChange={e => setForm({ ...form, supplierId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Select supplier</option>
                                        {(suppliersData || []).map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.companyName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                                    <select
                                        value={form.assignedToUserId}
                                        onChange={e => setForm({ ...form, assignedToUserId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Unassigned</option>
                                        {(usersData || []).map((u: any) => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Warranty Until</label>
                                    <input
                                        type="date"
                                        value={form.warrantyExpiryDate}
                                        onChange={e => setForm({ ...form, warrantyExpiryDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                    <input
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
                                    <input
                                        value={form.serialNumber}
                                        onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                        value={form.status}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                        <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                                        <option value="DISPOSED">Disposed</option>
                                        <option value="LOST">Lost</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                                    <input
                                        type="date"
                                        value={form.purchaseDate}
                                        onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.purchasePrice}
                                        onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.quantity}
                                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saveAssetMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                            >
                                {saveAssetMutation.isPending ? 'Saving...' : (editing ? 'Save Changes' : 'Create Asset')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
