import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, DollarSign, Calculator, CheckCircle, Loader2, Gavel, Package } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function Depreciation() {
    const queryClient = useQueryClient();
    const [viewTab, setViewTab] = useState<'assets' | 'tenders'>('assets');

    const { data, isLoading } = useQuery({
        queryKey: ['depreciation-summary'],
        queryFn: () => api.get('/depreciation/summary').then(r => r.data.data)
    });

    const runMutation = useMutation({
        mutationFn: () => api.post('/depreciation/run-monthly'),
        onSuccess: (res) => {
            toast.success(`Processed ${res.data.data.processed} assets`);
            queryClient.invalidateQueries({ queryKey: ['depreciation-summary'] });
        },
        onError: () => toast.error('Failed to run depreciation')
    });

    const summary = data?.summary || {};
    const assets = data?.assets || [];

    // Tender depreciation summary query
    const { data: tenderDepData, isLoading: tenderDepLoading } = useQuery({
        queryKey: ['depreciation-tender-summary'],
        queryFn: () => api.get('/depreciation/tender-summary').then(r => r.data.data),
        enabled: viewTab === 'tenders',
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Depreciation</h1>
                    <p className="text-slate-500 text-sm mt-1">Track asset value depreciation</p>
                </div>
                <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md disabled:opacity-50">
                    {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    Run Monthly Depreciation
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Accumulated Depreciation', value: `₹${((summary.totalAccumulatedDepreciation || 0) / 100000).toFixed(1)}L`, icon: TrendingDown, color: 'from-rose-500 to-pink-600' },
                    { label: 'Net Book Value', value: `₹${((summary.netBookValue || 0) / 100000).toFixed(1)}L`, icon: DollarSign, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Fully Depreciated', value: summary.fullyDepreciated || 0, icon: CheckCircle, color: 'from-amber-500 to-orange-600' },
                    { label: 'This Month', value: `₹${(summary.depreciationThisMonth || 0).toLocaleString()}`, icon: Calculator, color: 'from-indigo-500 to-blue-600' },
                ].map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-hover">
                        <div className="flex items-start justify-between">
                            <div><p className="text-sm text-slate-500">{c.label}</p><p className="text-2xl font-bold mt-1">{c.value}</p></div>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}><c.icon className="w-5 h-5 text-white" /></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setViewTab('assets')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'assets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Package className="w-4 h-4 inline mr-1.5" />Asset View
                </button>
                <button
                    onClick={() => setViewTab('tenders')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'tenders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Gavel className="w-4 h-4 inline mr-1.5" />Tender View
                </button>
            </div>

            {/* Asset View */}
            {viewTab === 'assets' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Method</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Purchase Price</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Accumulated</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Net Book Value</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Depreciated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : assets.map((a: any) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                    <p className="text-sm font-medium text-slate-800">{a.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{a.assetCode}</p>
                                </td>
                                <td className="px-5 py-3">
                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                        {a.method === 'STRAIGHT_LINE' ? 'SLM' : a.method === 'DECLINING_BALANCE' ? 'WDV' : a.method}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600 text-right">₹{a.purchasePrice.toLocaleString()}</td>
                                <td className="px-5 py-3 text-sm text-red-600 text-right">₹{Math.round(a.accumulatedDepreciation).toLocaleString()}</td>
                                <td className="px-5 py-3 text-sm font-semibold text-slate-800 text-right">₹{Math.round(a.netBookValue).toLocaleString()}</td>
                                <td className="px-5 py-3 w-36">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${a.percentDepreciated >= 90 ? 'bg-red-500' : a.percentDepreciated >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, a.percentDepreciated)}%` }}></div>
                                        </div>
                                        <span className="text-xs text-slate-500 w-10 text-right">{Math.round(a.percentDepreciated)}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}

            {/* Tender View */}
            {viewTab === 'tenders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tender</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Final Bill Value</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Assets</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Accumulated Dep.</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Net Book Value</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Depreciated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {tenderDepLoading ? Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : (
                            <>
                                {(tenderDepData?.tenders || []).map((t: any) => (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-medium text-slate-800">{t.tenderName}</p>
                                            <p className="text-xs text-slate-400 font-mono">{t.tenderNumber}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            {t.tenderType ? (
                                                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">{t.tenderType}</span>
                                            ) : <span className="text-xs text-slate-400">—</span>}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600 text-right">₹{(t.finalBillValue || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3 text-sm text-slate-600 text-right">{t.totalAssets}</td>
                                        <td className="px-5 py-3 text-sm text-red-600 text-right">₹{Math.round(t.totalAccumulatedDep).toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-slate-800 text-right">₹{Math.round(t.totalCurrentValue).toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3 w-36">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${t.depreciationPercentage >= 90 ? 'bg-red-500' : t.depreciationPercentage >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(100, t.depreciationPercentage)}%` }}></div>
                                                </div>
                                                <span className="text-xs text-slate-500 w-10 text-right">{t.depreciationPercentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {/* Unassigned assets row */}
                                {tenderDepData?.unassigned && tenderDepData.unassigned.totalAssets > 0 && (
                                    <tr className="bg-slate-50/50">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-medium text-slate-500 italic">Unassigned Assets</p>
                                            <p className="text-xs text-slate-400">Assets not linked to any tender</p>
                                        </td>
                                        <td className="px-5 py-3"><span className="text-xs text-slate-400">—</span></td>
                                        <td className="px-5 py-3 text-sm text-slate-500 text-right">—</td>
                                        <td className="px-5 py-3 text-sm text-slate-500 text-right">{tenderDepData.unassigned.totalAssets}</td>
                                        <td className="px-5 py-3 text-sm text-red-500 text-right">₹{Math.round(tenderDepData.unassigned.totalAccumulatedDep).toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-slate-600 text-right">₹{Math.round(tenderDepData.unassigned.totalCurrentValue).toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3 w-36">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                                    <div className="h-2 rounded-full bg-slate-400" style={{ width: `${Math.min(100, tenderDepData.unassigned.depreciationPercentage)}%` }}></div>
                                                </div>
                                                <span className="text-xs text-slate-500 w-10 text-right">{tenderDepData.unassigned.depreciationPercentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );
}
