import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowLeft, DollarSign, BarChart3, AlertTriangle, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../../api/client';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

export default function InvestmentDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-investment-summary'],
        queryFn: () => api.get('/extensions/investment/portfolio/summary').then(r => r.data.data),
    });

    const summary = data?.summary || {};
    const investments = data?.investments || [];
    const classData = Object.entries(summary.byAssetClass || {}).map(([name, v]: any) => ({ name, value: v.count, amount: v.value }));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Investment Management</h1>
                        <p className="text-slate-500 text-sm">Portfolio tracking, NAV, gains & dividend analysis</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Investments', value: summary.totalInvestments || 0, icon: BarChart3, color: 'from-emerald-500 to-teal-600' },
                    { label: 'Market Value', value: `₹${((summary.totalMarketValue || 0) / 100000).toFixed(1)}L`, icon: DollarSign, color: 'from-blue-500 to-indigo-600' },
                    { label: 'Unrealized Gain', value: `₹${((summary.totalUnrealizedGain || 0) / 1000).toFixed(1)}K`, icon: TrendingUp, color: 'from-amber-500 to-orange-600' },
                    { label: 'YTD Dividends', value: `₹${((summary.totalDividends || 0) / 1000).toFixed(1)}K`, icon: PieChart, color: 'from-purple-500 to-violet-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-white/80">{card.label}</p>
                            <card.icon className="w-5 h-5 text-white/60" />
                        </div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Allocation Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Asset Class Allocation</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                                <Pie data={classData} cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                                    {classData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </RechartsPie>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {classData.map((d: any, i: number) => (
                            <span key={i} className="flex items-center gap-1 text-xs text-slate-600">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                {d.name} ({d.value})
                            </span>
                        ))}
                    </div>
                </div>

                {/* Holdings Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Holdings</h3>
                    {isLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
                    ) : investments.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="font-medium">No investment data yet</p>
                            <p className="text-sm">Attach investment extensions to assets to see data here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="pb-3 font-medium">Asset</th>
                                    <th className="pb-3 font-medium">Class</th>
                                    <th className="pb-3 font-medium">Market Value</th>
                                    <th className="pb-3 font-medium">Unrealized P&L</th>
                                    <th className="pb-3 font-medium">Risk</th>
                                </tr></thead>
                                <tbody>
                                    {investments.slice(0, 15).map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 font-medium text-slate-800">{inv.asset?.name || inv.assetId}</td>
                                            <td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">{inv.assetClass || '—'}</span></td>
                                            <td className="py-3 font-mono">₹{(inv.marketValue || 0).toLocaleString()}</td>
                                            <td className={`py-3 font-mono ${inv.unrealizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{inv.unrealizedGain >= 0 ? '+' : ''}₹{(inv.unrealizedGain || 0).toLocaleString()}</td>
                                            <td className="py-3">{inv.riskScore ? <span className={`px-2 py-0.5 rounded-full text-xs ${inv.riskScore <= 3 ? 'bg-emerald-50 text-emerald-700' : inv.riskScore <= 6 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{inv.riskScore}/10</span> : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
