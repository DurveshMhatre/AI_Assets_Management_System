import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, IndianRupee, Users, CalendarClock, Building } from 'lucide-react';
import api from '../../api/client';

export default function RealEstateDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-realestate-summary'],
        queryFn: () => api.get('/extensions/real-estate/tenancy/summary').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const properties = data?.properties || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200"><Home className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Real Estate Management</h1><p className="text-slate-500 text-sm">Property tracking, tenancy, rental yield analysis</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Properties', value: summary.total || 0, icon: Building, color: 'from-amber-500 to-orange-600' },
                    { label: 'Occupied', value: summary.occupied || 0, icon: Users, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Monthly Rent', value: `₹${((summary.totalMonthlyRent || 0) / 1000).toFixed(1)}K`, icon: IndianRupee, color: 'from-blue-500 to-indigo-600' },
                    { label: 'Expiring Leases', value: summary.expiringLeases || 0, icon: CalendarClock, color: 'from-red-500 to-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Properties</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : properties.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Home className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No real estate data yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Area (sqft)</th><th className="pb-3 font-medium">Tenant</th><th className="pb-3 font-medium">Rent/mo</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>
                        {properties.slice(0, 15).map((p: any) => (
                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{p.asset?.name || p.assetId}</td><td className="py-3 text-xs">{p.propertyType || '—'}</td><td className="py-3 font-mono">{p.carpetAreaSqft?.toLocaleString() || '—'}</td><td className="py-3">{p.tenantName || '—'}</td><td className="py-3 font-mono">₹{(p.monthlyRent || 0).toLocaleString()}</td><td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.occupancyStatus === 'OCCUPIED' ? 'bg-emerald-50 text-emerald-700' : p.occupancyStatus === 'UNDER_RENOVATION' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.occupancyStatus}</span></td></tr>
                        ))}
                    </tbody></table></div>
                )}
            </div>
        </div>
    );
}
