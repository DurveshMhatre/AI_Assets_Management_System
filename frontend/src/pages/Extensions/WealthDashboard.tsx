import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wallet, ArrowLeft, IndianRupee, Target, ShieldCheck, PiggyBank } from 'lucide-react';
import api from '../../api/client';

export default function WealthDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-wealth-summary'],
        queryFn: () => api.get('/extensions/wealth/networth/summary').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const assets = data?.assets || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-200"><Wallet className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Wealth Management</h1><p className="text-slate-500 text-sm">Net worth aggregation, tax optimization & allocation tracking</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Assets', value: summary.total || 0, icon: Wallet, color: 'from-yellow-500 to-amber-600' },
                    { label: 'Net Worth', value: `₹${((summary.totalNetWorth || 0) / 100000).toFixed(1)}L`, icon: IndianRupee, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Capital Gains Tax', value: `₹${((summary.totalCapitalGains || 0) / 1000).toFixed(1)}K`, icon: Target, color: 'from-red-500 to-rose-600' },
                    { label: 'Dep. Benefit', value: `₹${((summary.totalDepreciationBenefit || 0) / 1000).toFixed(1)}K`, icon: PiggyBank, color: 'from-purple-500 to-violet-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Wealth Assets</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : assets.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No wealth data yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Client</th><th className="pb-3 font-medium">Risk</th><th className="pb-3 font-medium">Horizon</th><th className="pb-3 font-medium">Goal</th><th className="pb-3 font-medium">Current Value</th></tr></thead><tbody>
                        {assets.slice(0, 15).map((a: any) => (
                            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{a.asset?.name || a.assetId}</td><td className="py-3 text-xs">{a.clientName || '—'}</td><td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.clientRiskAppetite === 'CONSERVATIVE' ? 'bg-emerald-50 text-emerald-700' : a.clientRiskAppetite === 'AGGRESSIVE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{a.clientRiskAppetite || '—'}</span></td><td className="py-3 text-xs">{a.investmentHorizon || '—'}</td><td className="py-3 text-xs">{a.financialGoal || '—'}</td><td className="py-3 font-mono">₹{(a.asset?.currentValue || 0).toLocaleString()}</td></tr>
                        ))}
                    </tbody></table></div>
                )}
            </div>
        </div>
    );
}
