import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, ShieldCheck, AlertTriangle, MapPin, CalendarClock } from 'lucide-react';
import api from '../../api/client';

export default function InfrastructureDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-infra-summary'],
        queryFn: () => api.get('/extensions/infrastructure/condition/summary').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const assets = data?.assets || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-200"><Building2 className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Infrastructure Management</h1><p className="text-slate-500 text-sm">Condition monitoring, inspections, compliance & GIS</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Infrastructure', value: summary.total || 0, icon: Building2, color: 'from-orange-500 to-red-600' },
                    { label: 'Avg Condition Index', value: `${(summary.avgConditionIndex || 0).toFixed(1)}`, icon: ShieldCheck, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Overdue Inspections', value: summary.overdueInspections || 0, icon: CalendarClock, color: 'from-red-500 to-rose-600' },
                    { label: 'Non-Compliant', value: summary.byCompliance?.['NON_COMPLIANT'] || 0, icon: AlertTriangle, color: 'from-amber-500 to-orange-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Infrastructure Assets</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : assets.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No infrastructure data yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Condition</th><th className="pb-3 font-medium">Compliance</th><th className="pb-3 font-medium">Next Inspection</th><th className="pb-3 font-medium">Residual Life</th><th className="pb-3 font-medium">Severity</th></tr></thead><tbody>
                        {assets.slice(0, 15).map((a: any) => (
                            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{a.asset?.name || a.assetId}</td><td className="py-3 font-mono">{a.conditionIndex?.toFixed(1) || '—'}</td><td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.complianceStatus === 'COMPLIANT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{a.complianceStatus}</span></td><td className="py-3 text-xs">{a.nextInspectionDate ? new Date(a.nextInspectionDate).toLocaleDateString() : '—'}</td><td className="py-3 font-mono">{a.residualLifeYears ? `${a.residualLifeYears} yrs` : '—'}</td><td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.failureSeverity === 'CRITICAL' ? 'bg-red-50 text-red-700' : a.failureSeverity === 'HIGH' ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-600'}`}>{a.failureSeverity || '—'}</span></td></tr>
                        ))}
                    </tbody></table></div>
                )}
            </div>
        </div>
    );
}
