import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Calendar, MapPin, TrendingDown, User, Tag, Shield, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../../api/client';
import toast from 'react-hot-toast';

const DEPRECIATION_METHODS = [
    { value: 'STRAIGHT_LINE', label: 'Straight Line' },
    { value: 'DECLINING_BALANCE', label: 'Declining Balance' },
    { value: 'SUM_OF_YEARS_DIGITS', label: 'Sum of Years Digits' },
];

export default function AssetDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'details' | 'depreciation'>('details');
    const [depPage, setDepPage] = useState(1);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [recalculating, setRecalculating] = useState(false);
    const DEP_PAGE_SIZE = 12;

    const { data: asset, isLoading } = useQuery({
        queryKey: ['asset', id],
        queryFn: () => api.get(`/assets/${id}`).then(r => r.data.data)
    });

    const { data: depData } = useQuery({
        queryKey: ['dep-summary', id],
        queryFn: () => api.get(`/depreciation/${id}/asset-summary`).then(r => r.data.data),
        enabled: !!id
    });

    // Set initial method once dep data is loaded
    if (depData && !selectedMethod) {
        const schedule = depData.schedule || [];
        if (schedule.length > 0 && schedule[0].method) {
            setSelectedMethod(schedule[0].method);
        }
    }

    const handleRecalculate = async () => {
        if (!selectedMethod || recalculating) return;
        setRecalculating(true);
        try {
            await api.post(`/assets/${id}/recalculate-depreciation`, { method: selectedMethod });
            toast.success(`Depreciation recalculated using ${DEPRECIATION_METHODS.find(m => m.value === selectedMethod)?.label || selectedMethod}`);
            queryClient.invalidateQueries({ queryKey: ['dep-summary', id] });
            queryClient.invalidateQueries({ queryKey: ['asset', id] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Recalculation failed');
        } finally {
            setRecalculating(false);
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!asset) return <div className="text-center py-8 text-slate-500">Asset not found</div>;

    const depPercent = asset.purchasePrice > 0
        ? Math.min(100, ((asset.purchasePrice - asset.currentValue) / asset.purchasePrice) * 100)
        : 0;

    const statusColors: Record<string, string> = {
        ACTIVE: 'bg-emerald-100 text-emerald-700',
        INACTIVE: 'bg-slate-100 text-slate-600',
        UNDER_MAINTENANCE: 'bg-amber-100 text-amber-700',
    };

    // Chart data from depreciation schedule
    const chartData = depData?.schedule?.map((s: any) => ({
        period: `${String(s.month).padStart(2, '0')}/${s.year}`,
        bookValue: s.closingValue,
        monthlyDep: s.depreciationAmount,
        accumulated: s.cumulativeDepreciation
    })) ?? [];

    const today = new Date();
    const todayLabel = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    // Paginated schedule
    const schedule = depData?.schedule ?? [];
    const totalDepPages = Math.ceil(schedule.length / DEP_PAGE_SIZE);
    const pagedSchedule = schedule.slice((depPage - 1) * DEP_PAGE_SIZE, depPage * DEP_PAGE_SIZE);

    const handleDepExport = async () => {
        try {
            const res = await api.get(`/depreciation/${id}/export`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset.name}_depreciation.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // silent
        }
    };

    const fmtCurrency = (v: number) =>
        v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

    // Detect fully depreciated
    const isFullyDepreciated = depData && depData.currentBookValue <= (asset.purchasePrice * ((depData.salvagePercent || 10) / 100));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/assets')} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5" /></button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">{asset.name}</h1>
                    <p className="text-slate-500 text-sm font-mono">{asset.assetCode}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[asset.status] || 'bg-slate-100'}`}>
                    {asset.status.replace(/_/g, ' ')}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                        {(['details', 'depreciation'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Details Tab */}
                    {activeTab === 'details' && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-600" /> Details
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Serial Number', value: asset.serialNumber || '—' },
                                    { label: 'Brand', value: asset.brand?.name || '—' },
                                    { label: 'Type', value: asset.assetType?.name || '—' },
                                    { label: 'Supplier', value: asset.supplier?.companyName || '—' },
                                    { label: 'Purchase Date', value: asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('en-IN') : '—' },
                                    { label: 'Warranty Until', value: asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate).toLocaleDateString('en-IN') : '—' },
                                    { label: 'Quantity', value: asset.quantity ?? '—' },
                                    { label: 'Assigned To', value: asset.assignedTo?.name || '—' },
                                ].map((item, i) => (
                                    <div key={i} className="py-2">
                                        <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                                        <p className="text-sm font-medium text-slate-800">{String(item.value)}</p>
                                    </div>
                                ))}

                                {/* Location — multi-line */}
                                <div className="py-2 col-span-2">
                                    <p className="text-xs text-slate-400 mb-1">Location / Branch</p>
                                    <p className="font-medium text-sm text-slate-800">{asset.branch?.name || asset.location || '—'}</p>
                                    {asset.branch?.city && (
                                        <p className="text-sm text-slate-500">
                                            {asset.branch.city}{asset.branch.pincode ? ` — ${asset.branch.pincode}` : ''}
                                        </p>
                                    )}
                                    {asset.branch?.address && (
                                        <p className="text-xs text-slate-400">{asset.branch.address}</p>
                                    )}
                                </div>
                            </div>

                            {asset.description && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 mb-1">Description</p>
                                    <p className="text-sm text-slate-700">{asset.description}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Depreciation Tab */}
                    {activeTab === 'depreciation' && (
                        <div className="space-y-4">
                            {!depData ? (
                                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center text-slate-400">
                                    No depreciation schedule found. Add an Asset Type with purchase price to auto-generate.
                                </div>
                            ) : (
                                <>
                                    {/* Fully Depreciated Warning */}
                                    {isFullyDepreciated && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-red-800">Fully Depreciated</p>
                                                <p className="text-xs text-red-600">This asset has reached its salvage value. No further depreciation will be calculated.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Method Selector & Recalculate */}
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Depreciation Method</label>
                                                <select
                                                    value={selectedMethod}
                                                    onChange={e => setSelectedMethod(e.target.value)}
                                                    className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                                >
                                                    {DEPRECIATION_METHODS.map(m => (
                                                        <option key={m.value} value={m.value}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleRecalculate}
                                                disabled={recalculating}
                                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-md shadow-indigo-500/25"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                                                {recalculating ? 'Recalculating...' : 'Recalculate'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Change the method and click Recalculate to regenerate the full depreciation schedule.
                                        </p>
                                    </div>

                                    {/* Sub A: 5 summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {[
                                            { label: 'Original Cost', value: fmtCurrency(depData.originalCost), color: 'text-slate-800' },
                                            { label: 'Book Value', value: fmtCurrency(depData.currentBookValue), color: depData.percentDepreciated > 80 ? 'text-red-600' : 'text-slate-800' },
                                            { label: 'Depreciated', value: fmtCurrency(depData.totalDepreciated), color: 'text-amber-600' },
                                            { label: '% Depreciated', value: `${depData.percentDepreciated}%`, color: depData.percentDepreciated > 80 ? 'text-red-600' : depData.percentDepreciated > 50 ? 'text-amber-600' : 'text-emerald-600' },
                                            { label: 'Remaining Life', value: `${Math.floor(depData.remainingMonths / 12)}y ${depData.remainingMonths % 12}m`, color: depData.remainingMonths < 12 ? 'text-red-600' : 'text-slate-800' },
                                        ].map((card, i) => (
                                            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
                                                <p className="text-xs text-slate-400 mb-1">{card.label}</p>
                                                <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Sub B: Area Chart with Accumulated Depreciation */}
                                    {chartData.length > 0 && (
                                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-semibold text-slate-700">Book Value Over Time</h3>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-3 h-0.5 bg-indigo-600 inline-block rounded" /> Book Value
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-3 h-0.5 bg-rose-400 inline-block rounded" /> Accumulated Dep.
                                                    </span>
                                                </div>
                                            </div>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                                    <defs>
                                                        <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="25%" stopColor="#4F46E5" stopOpacity={0.25} />
                                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.02} />
                                                        </linearGradient>
                                                        <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="25%" stopColor="#F43F5E" stopOpacity={0.15} />
                                                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.02} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                                    <XAxis dataKey="period" interval={11} fontSize={11} tick={{ fill: '#94A3B8' }} />
                                                    <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} fontSize={11} tick={{ fill: '#94A3B8' }} />
                                                    <Tooltip
                                                        formatter={(v: any, name: string) => [fmtCurrency(v), name === 'bookValue' ? 'Book Value' : name === 'accumulated' ? 'Accumulated Dep.' : 'Monthly Dep.']}
                                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: 12 }}
                                                    />
                                                    <ReferenceLine y={depData.salvageValue} stroke="#EF4444" strokeDasharray="5 5"
                                                        label={{ value: 'Salvage', position: 'insideTopRight', fontSize: 10, fill: '#EF4444' }} />
                                                    <ReferenceLine x={todayLabel} stroke="#94A3B8" strokeDasharray="5 5"
                                                        label={{ value: 'Today', position: 'insideTopLeft', fontSize: 10, fill: '#94A3B8' }} />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="bookValue"
                                                        stroke="#4F46E5"
                                                        strokeWidth={2}
                                                        fill="url(#depGrad)"
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="accumulated"
                                                        stroke="#F43F5E"
                                                        strokeWidth={1.5}
                                                        fill="url(#accGrad)"
                                                        strokeDasharray="4 2"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {/* Sub C: Schedule Table */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                                            <h3 className="text-sm font-semibold text-slate-700">Depreciation Schedule</h3>
                                            <button
                                                onClick={handleDepExport}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download Excel
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50">
                                                        {['#', 'Period', 'Opening', 'Depreciation', 'Closing', 'Cumulative', 'Method'].map(h => (
                                                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {pagedSchedule.map((s: any, i: number) => {
                                                        const rowNum = (depPage - 1) * DEP_PAGE_SIZE + i + 1;
                                                        const isCurrent = s.year === today.getFullYear() && s.month === today.getMonth() + 1;
                                                        return (
                                                            <tr key={i} className={`${isCurrent ? 'bg-indigo-50 border-l-4 border-l-indigo-500 font-semibold' : 'hover:bg-slate-50'}`}>
                                                                <td className="px-4 py-2.5 text-slate-500 text-xs">{rowNum}</td>
                                                                <td className="px-4 py-2.5 text-slate-700">{s.year}-{String(s.month).padStart(2, '0')}</td>
                                                                <td className="px-4 py-2.5 text-slate-600">{fmtCurrency(s.openingValue)}</td>
                                                                <td className="px-4 py-2.5 text-red-500">-{fmtCurrency(s.depreciationAmount)}</td>
                                                                <td className="px-4 py-2.5 text-slate-800">{fmtCurrency(s.closingValue)}</td>
                                                                <td className="px-4 py-2.5 text-slate-500">{fmtCurrency(s.cumulativeDepreciation)}</td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                        s.method === 'SUM_OF_YEARS_DIGITS' ? 'bg-purple-100 text-purple-600' :
                                                                        s.method === 'DECLINING_BALANCE' ? 'bg-amber-100 text-amber-600' :
                                                                        'bg-slate-100 text-slate-600'
                                                                    }`}>{s.method?.replace(/_/g, ' ')}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {totalDepPages > 1 && (
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                                                <p className="text-xs text-slate-500">
                                                    Showing {(depPage - 1) * DEP_PAGE_SIZE + 1}–{Math.min(depPage * DEP_PAGE_SIZE, schedule.length)} of {schedule.length}
                                                </p>
                                                <div className="flex gap-1">
                                                    <button disabled={depPage <= 1} onClick={() => setDepPage(p => p - 1)}
                                                        className="px-2.5 py-1 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50">Prev</button>
                                                    <button disabled={depPage >= totalDepPages} onClick={() => setDepPage(p => p + 1)}
                                                        className="px-2.5 py-1 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50">Next</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                <div className="space-y-5">
                    {/* Valuation Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/25">
                        <h3 className="text-sm font-medium text-indigo-100 mb-3">Current Valuation</h3>
                        <p className="text-3xl font-bold">₹{asset.currentValue.toLocaleString()}</p>
                        <p className="text-sm text-indigo-200 mt-1">Purchase: ₹{asset.purchasePrice.toLocaleString()}</p>
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-indigo-200 mb-1">
                                <span>Depreciation</span>
                                <span>{depPercent.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-2">
                                <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${depPercent}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Book Value Card (from live depreciation data) */}
                    {depData && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Current Book Value</p>
                            <p className="text-2xl font-bold mt-1 text-slate-900">
                                ₹{depData.currentBookValue.toLocaleString('en-IN')}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${depData.percentDepreciated > 80 ? 'bg-red-100 text-red-700' :
                                    depData.percentDepreciated > 50 ? 'bg-amber-100 text-amber-700' :
                                        'bg-green-100 text-green-700'
                                }`}>
                                {depData.percentDepreciated}% depreciated
                            </span>
                            {isFullyDepreciated && (
                                <div className="mt-2 flex items-center gap-1.5 text-red-600">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Fully Depreciated</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Info */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
                        {[
                            { icon: Calendar, label: 'Purchase Date', value: asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('en-IN') : '—' },
                            { icon: User, label: 'Assigned To', value: asset.assignedTo?.name || 'Unassigned' },
                            { icon: Tag, label: 'Asset Type', value: asset.assetType?.name || '—' },
                            { icon: Shield, label: 'Warranty', value: asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate).toLocaleDateString('en-IN') : '—' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                                <item.icon className="w-4 h-4 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-400">{item.label}</p>
                                    <p className="text-sm font-medium text-slate-700">{item.value}</p>
                                </div>
                            </div>
                        ))}

                        {/* Branch info multi-line */}
                        <div className="flex items-start gap-3 py-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-400">Branch</p>
                                <p className="text-sm font-medium text-slate-700">{asset.branch?.name || asset.location || '—'}</p>
                                {asset.branch?.city && (
                                    <p className="text-xs text-slate-500">{asset.branch.city}{asset.branch.pincode ? ` — ${asset.branch.pincode}` : ''}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
