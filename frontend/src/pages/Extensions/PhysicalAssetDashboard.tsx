import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cog, ArrowLeft, Activity, AlertTriangle, Clock, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../api/client';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

export default function PhysicalAssetDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-physical-summary'],
        queryFn: () => api.get('/extensions/physical/lifecycle/summary').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const assets = data?.assets || [];
    const stageData = Object.entries(summary.byStage || {}).map(([name, count]: any) => ({ name, count }));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200"><Cog className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Physical Asset Management</h1><p className="text-slate-500 text-sm">Lifecycle, OEE, failure tracking & predictive maintenance</p></div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Assets', value: summary.total || 0, icon: Cog, color: 'from-blue-500 to-indigo-600' },
                    { label: 'Avg OEE Score', value: `${(summary.avgOEE || 0).toFixed(1)}%`, icon: Gauge, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Avg Condition', value: `${(summary.avgConditionScore || 0).toFixed(1)}`, icon: Activity, color: 'from-amber-500 to-orange-600' },
                    { label: 'Upcoming PM', value: summary.upcomingPM || 0, icon: Clock, color: 'from-red-500 to-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Lifecycle Stage Distribution</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stageData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} /><YAxis tick={{ fontSize: 11, fill: '#64748B' }} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{stageData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Equipment Status</h3>
                    {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : assets.length === 0 ? (
                        <div className="text-center py-12 text-slate-400"><Cog className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No physical asset data yet</p></div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Stage</th><th className="pb-3 font-medium">OEE</th><th className="pb-3 font-medium">MTBF (hrs)</th><th className="pb-3 font-medium">Failures</th></tr></thead><tbody>
                            {assets.slice(0, 15).map((a: any) => (
                                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-3 font-medium text-slate-800">{a.asset?.name || a.assetId}</td>
                                    <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.lifecycleStage === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : a.lifecycleStage === 'RETIRED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{a.lifecycleStage}</span></td>
                                    <td className="py-3 font-mono">{a.oeeScore ? `${a.oeeScore.toFixed(1)}%` : '—'}</td>
                                    <td className="py-3 font-mono">{a.mtbfHours?.toLocaleString() || '—'}</td>
                                    <td className="py-3">{a.failureCount}</td>
                                </tr>
                            ))}
                        </tbody></table></div>
                    )}
                </div>
            </div>
        </div>
    );
}
