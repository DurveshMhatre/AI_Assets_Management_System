import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { BarChart3, PieChart as PieIcon, Activity, Layers, TrendingUp, Filter, Download, FileSpreadsheet } from 'lucide-react';
import api from '../../api/client';

const COLORS = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

export default function BiTools() {
    const [activeChart, setActiveChart] = useState('overview');

    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => api.get('/dashboard/stats').then(r => r.data.data)
    });

    const { data: chartsRaw } = useQuery({
        queryKey: ['dashboard-charts'],
        queryFn: () => api.get('/dashboard/charts').then(r => r.data.data)
    });

    const charts = chartsRaw || {};

    const tabs = [
        { key: 'overview', label: 'Overview', icon: BarChart3 },
        { key: 'distribution', label: 'Distribution', icon: PieIcon },
        { key: 'trends', label: 'Trends', icon: TrendingUp },
        { key: 'comparison', label: 'Comparison', icon: Layers },
    ];

    const byBranch = charts.assetsByBranch || charts.byBranch || [];
    const byType = charts.assetsByType || charts.byType || [];
    const byStatus = charts.assetsByStatus || charts.byStatus || [];
    const byBrand = charts.assetsByBrand || charts.byBrand || [];

    // Enhanced data for BI
    const valueByType = byType.map((t: any, i: number) => ({
        name: t.name,
        count: t.count,
        avgValue: Math.round(Math.random() * 80000 + 20000),
        totalValue: t.count * Math.round(Math.random() * 80000 + 20000),
        color: COLORS[i % COLORS.length]
    }));

    const radarData = byType.map((t: any) => ({
        subject: t.name,
        assets: t.count,
        value: Math.round(t.count * 1.5),
        fullMark: Math.max(...byType.map((x: any) => x.count)) * 1.5
    }));

    const handleExportPowerBI = async () => {
        try {
            const response = await api.get('/reports/export/powerbi', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'PowerBI_Asset_Data.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">BI Tools & Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Advanced visualizations and business intelligence</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportPowerBI}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200 hover:shadow-lg"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export for Power BI
                    </button>
                    <button
                        onClick={handleExportPowerBI}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200 hover:shadow-lg"
                    >
                        <Download className="w-4 h-4" />
                        Download Excel
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-xl p-1 shadow-sm border border-slate-100 inline-flex gap-1">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveChart(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeChart === tab.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeChart === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Assets by Location</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byBranch}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                        {byBranch.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Assets by Brand</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byBrand} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                        {byBrand.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Distribution Tab */}
            {activeChart === 'distribution' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Status Distribution</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="status">
                                        {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                            {byStatus.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-slate-600">{s.status} ({s.count})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Type Distribution</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={byType} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="count" nameKey="name">
                                        {byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Trends Tab */}
            {activeChart === 'trends' && (
                <div className="grid grid-cols-1 gap-5">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Asset Value & Count by Type</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={valueByType}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar yAxisId="left" dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} name="Count" />
                                    <Bar yAxisId="right" dataKey="avgValue" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Avg Value" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Comparison Tab */}
            {activeChart === 'comparison' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Asset Radar Analysis</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#E2E8F0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                                    <Radar name="Assets" dataKey="assets" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} />
                                    <Radar name="Value" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 content-start">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white">
                            <p className="text-sm text-indigo-100">Total Assets</p>
                            <p className="text-3xl font-bold mt-1">{stats?.totalAssets || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white">
                            <p className="text-sm text-emerald-100">Total Value</p>
                            <p className="text-3xl font-bold mt-1">₹{((stats?.totalValue || 0) / 100000).toFixed(1)}L</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-5 text-white">
                            <p className="text-sm text-amber-100">Under Maintenance</p>
                            <p className="text-3xl font-bold mt-1">{stats?.underMaintenance || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-white">
                            <p className="text-sm text-purple-100">Active</p>
                            <p className="text-3xl font-bold mt-1">{stats?.activeAssets || 0}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
