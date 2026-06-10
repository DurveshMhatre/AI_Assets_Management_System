import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calculator, ArrowLeft, AlertTriangle, BookOpen, IndianRupee } from 'lucide-react';
import api from '../../api/client';

export default function FixedAssetDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-fixed-asset-summary'],
        queryFn: () => api.get('/extensions/fixed-asset/accounting/register').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const register = data?.register || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200"><Calculator className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Fixed Asset / Accounting</h1><p className="text-slate-500 text-sm">WDV register, accounting blocks, impairment & statutory reporting</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Fixed Assets', value: summary.total || 0, icon: BookOpen, color: 'from-violet-500 to-purple-600' },
                    { label: 'Opening WDV', value: `₹${((summary.totalWDVOpening || 0) / 100000).toFixed(1)}L`, icon: IndianRupee, color: 'from-blue-500 to-indigo-600' },
                    { label: 'Additions', value: `₹${((summary.totalAdditions || 0) / 100000).toFixed(1)}L`, icon: Calculator, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Impaired', value: summary.impaired || 0, icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Fixed Asset Register</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : register.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Calculator className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No fixed asset data yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Block</th><th className="pb-3 font-medium">FY</th><th className="pb-3 font-medium">Opening WDV</th><th className="pb-3 font-medium">Closing WDV</th><th className="pb-3 font-medium">Impaired</th></tr></thead><tbody>
                        {register.slice(0, 15).map((a: any) => (
                            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{a.asset?.name || a.assetId}</td><td className="py-3 text-xs">{a.accountingBlock || '—'}</td><td className="py-3 text-xs">{a.financialYear || '—'}</td><td className="py-3 font-mono">₹{(a.wdvOpeningBalance || 0).toLocaleString()}</td><td className="py-3 font-mono">₹{(a.wdvClosingBalance || 0).toLocaleString()}</td><td className="py-3">{a.impairmentFlag ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700">Yes</span> : <span className="text-slate-400">No</span>}</td></tr>
                        ))}
                    </tbody></table></div>
                )}
            </div>
        </div>
    );
}
