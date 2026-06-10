import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Monitor, ArrowLeft, Cpu, KeyRound, Cloud, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/client';

export default function ITAssetDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-it-summary'],
        queryFn: () => api.get('/extensions/it/licenses/compliance').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const assets = data?.assets || [];
    const chartData = [
        { name: 'HAM', count: summary.hamCount || 0 },
        { name: 'SAM', count: summary.samCount || 0 },
        { name: 'CAM', count: summary.camCount || 0 },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-200"><Monitor className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">IT Asset Management</h1><p className="text-slate-500 text-sm">HAM / SAM / CAM tracking, license compliance & cloud costs</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total IT Assets', value: summary.total || 0, icon: Monitor, color: 'from-cyan-500 to-blue-600' },
                    { label: 'Licensed Seats', value: `${summary.totalAllocatedSeats || 0}/${summary.totalLicensedSeats || 0}`, icon: KeyRound, color: 'from-purple-500 to-violet-600' },
                    { label: 'Monthly Cloud Cost', value: `₹${((summary.totalMonthlyCost || 0) / 1000).toFixed(1)}K`, icon: Cloud, color: 'from-amber-500 to-orange-600' },
                    { label: 'Expiring Licenses', value: summary.expiringLicenses || 0, icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">HAM / SAM / CAM Split</h3>
                    <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">IT Assets</h3>
                    {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : assets.length === 0 ? (
                        <div className="text-center py-12 text-slate-400"><Monitor className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No IT asset data yet</p></div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Specs</th><th className="pb-3 font-medium">License/Cloud</th></tr></thead><tbody>
                            {assets.slice(0, 15).map((a: any) => (
                                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{a.asset?.name || a.assetId}</td><td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.subType === 'HAM' ? 'bg-blue-50 text-blue-700' : a.subType === 'SAM' ? 'bg-purple-50 text-purple-700' : 'bg-cyan-50 text-cyan-700'}`}>{a.subType}</span></td><td className="py-3 text-xs text-slate-600">{a.subType === 'HAM' ? `${a.cpuModel || ''} ${a.ramGB ? a.ramGB + 'GB' : ''}` : a.subType === 'SAM' ? `${a.allocatedSeats || 0}/${a.licensedSeats || 0} seats` : a.cloudProvider || '—'}</td><td className="py-3 text-xs">{a.subType === 'SAM' ? (a.licenseExpiry ? new Date(a.licenseExpiry).toLocaleDateString() : '—') : a.subType === 'CAM' ? `₹${(a.monthlyCost || 0).toLocaleString()}/mo` : a.eolDate ? new Date(a.eolDate).toLocaleDateString() : '—'}</td></tr>
                            ))}
                        </tbody></table></div>
                    )}
                </div>
            </div>
        </div>
    );
}
