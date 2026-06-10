import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Leaf, ArrowLeft, Wind, TreePine, AlertTriangle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../api/client';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#06B6D4', '#EF4444'];

export default function NaturalResourceDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-natural-summary'],
        queryFn: () => api.get('/extensions/natural-resource/carbon/summary').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const resources = data?.resources || [];
    const typeData = Object.entries(summary.byResourceType || {}).map(([name, count]: any) => ({ name, count }));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-green-200"><Leaf className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Natural Resource Management</h1><p className="text-slate-500 text-sm">Carbon credits, ecosystem valuation, NDVI & degradation</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Resources', value: summary.total || 0, icon: TreePine, color: 'from-green-500 to-emerald-700' },
                    { label: 'Carbon Credits', value: (summary.totalCarbonCredits || 0).toLocaleString(), icon: Wind, color: 'from-cyan-500 to-blue-600' },
                    { label: 'Ecosystem Value', value: `₹${((summary.totalEcosystemValue || 0) / 100000).toFixed(1)}L`, icon: BarChart3, color: 'from-amber-500 to-orange-600' },
                    { label: 'Overdue Surveys', value: summary.overdueSurveys || 0, icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Resource Types</h3>
                    <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{typeData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Resources</h3>
                    {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : resources.length === 0 ? (
                        <div className="text-center py-12 text-slate-400"><Leaf className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No natural resource data yet</p></div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Carbon Credits</th><th className="pb-3 font-medium">NDVI</th><th className="pb-3 font-medium">Degradation</th><th className="pb-3 font-medium">Next Survey</th></tr></thead><tbody>
                            {resources.slice(0, 15).map((r: any) => (
                                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-3 font-medium text-slate-800">{r.asset?.name || r.assetId}</td><td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">{r.resourceType || '—'}</span></td><td className="py-3 font-mono">{r.carbonCredits?.toLocaleString() || '0'}</td><td className="py-3 font-mono">{r.ndviScore?.toFixed(2) || '—'}</td><td className="py-3">{r.degradationIndex != null ? <span className={`px-2 py-0.5 rounded-full text-xs ${r.degradationIndex <= 30 ? 'bg-emerald-50 text-emerald-700' : r.degradationIndex <= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{r.degradationIndex.toFixed(1)}</span> : '—'}</td><td className="py-3 text-xs">{r.nextAssessmentDate ? new Date(r.nextAssessmentDate).toLocaleDateString() : '—'}</td></tr>
                            ))}
                        </tbody></table></div>
                    )}
                </div>
            </div>
        </div>
    );
}
