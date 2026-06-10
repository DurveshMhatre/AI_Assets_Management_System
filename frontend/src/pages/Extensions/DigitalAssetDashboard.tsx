import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Image, ArrowLeft, Download, Tag, ShieldAlert } from 'lucide-react';
import api from '../../api/client';

export default function DigitalAssetDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['ext-digital-summary'],
        queryFn: () => api.get('/extensions/digital/media/library').then(r => r.data.data),
    });
    const summary = data?.summary || {};
    const media = data?.media || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link to="/extensions" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-200"><Image className="w-5 h-5 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900">Digital Asset Management</h1><p className="text-slate-500 text-sm">Media library, keyword tagging, version control & rights</p></div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Media', value: summary.total || 0, icon: Image, color: 'from-pink-500 to-rose-600' },
                    { label: 'Total Downloads', value: (summary.totalDownloads || 0).toLocaleString(), icon: Download, color: 'from-blue-500 to-indigo-600' },
                    { label: 'Expiring Rights', value: summary.expiringRights || 0, icon: ShieldAlert, color: 'from-amber-500 to-orange-600' },
                    { label: 'Media Types', value: Object.keys(summary.byMediaType || {}).length, icon: Tag, color: 'from-purple-500 to-violet-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="flex items-center justify-between"><p className="text-sm text-white/80">{card.label}</p><card.icon className="w-5 h-5 text-white/60" /></div>
                        <p className="text-2xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Media Library</h3>
                {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> : media.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Image className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="font-medium">No digital assets yet</p></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {media.slice(0, 12).map((m: any) => (
                            <div key={m.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Image className="w-5 h-5 text-slate-400" /></div>
                                    <div className="flex-1 min-w-0"><p className="font-medium text-slate-800 truncate">{m.asset?.name || m.assetId}</p><p className="text-xs text-slate-500">{m.mediaType || 'Unknown'} • v{m.versionNumber}</p></div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">{(JSON.parse(m.keywords || '[]') as string[]).slice(0, 4).map((kw: string, i: number) => <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">{kw}</span>)}</div>
                                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                    <span>{m.downloadCount} downloads</span>
                                    <span className={`px-2 py-0.5 rounded-full ${m.usageRights === 'PROPRIETARY' ? 'bg-red-50 text-red-700' : m.usageRights === 'LICENSED' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{m.usageRights || 'Unknown'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
