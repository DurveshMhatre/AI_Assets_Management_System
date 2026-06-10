import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Landmark, ArrowLeft, Eye, FileText, ShoppingCart, ArrowRightLeft } from 'lucide-react';
import api from '../../api/client';

export default function GovernmentDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-govt-summary'],
        queryFn: () => api.get('/extensions/government/public/register').then(r => r.data.data),
    });
    const register = data?.register || [];
    const total = data?.total || 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-700 flex items-center justify-center shadow-lg shadow-slate-200"><Landmark className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Public / Government Assets</h1><p className="text-slate-500 text-sm">GFR classification, GeM portal, custodian tracking & public register</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Public Register', value: total, icon: Eye, color: 'from-slate-500 to-gray-700' },
                    { label: 'Tender Refs', value: register.filter((r: any) => r.tenderRefNumber).length, icon: FileText, color: 'from-blue-500 to-indigo-600' },
                    { label: 'GeM Listed', value: register.filter((r: any) => r.gemPortalId).length, icon: ShoppingCart, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Transfers', value: register.filter((r: any) => r.interDeptTransferTo).length, icon: ArrowRightLeft, color: 'from-amber-500 to-orange-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Public Asset Register</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : register.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Landmark className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No government asset data yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Custodian</th><th className="pb-3 font-medium">GFR Class</th><th className="pb-3 font-medium">Procurement</th><th className="pb-3 font-medium">Disposal</th><th className="pb-3 font-medium">Value</th></tr></thead><tbody>
                        {register.slice(0, 15).map((r: any) => (
                            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{r.asset?.name || r.assetId}</td><td className="py-3 text-xs">{r.custodianDept || '—'}</td><td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">{r.gfrClassification || '—'}</span></td><td className="py-3 text-xs">{r.procurementMode || '—'}</td><td className="py-3 text-xs">{r.disposalMethod || '—'}</td><td className="py-3 font-mono">₹{(r.asset?.currentValue || 0).toLocaleString()}</td></tr>
                        ))}
                    </tbody></table></div>
                )}
            </div>
        </div>
    );
}
