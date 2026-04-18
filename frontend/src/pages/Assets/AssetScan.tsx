import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Calendar, MapPin, Tag, Shield, User, AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AssetScan() {
    const { id } = useParams();

    const { data: asset, isLoading, error } = useQuery({
        queryKey: ['public-asset', id],
        queryFn: () => axios.get(`${API_BASE}/assets/public/${id}`).then(r => r.data.data),
    });

    if (isLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-500 text-sm mt-3">Loading asset details...</p>
            </div>
        </div>
    );

    if (error || !asset) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-slate-800 mb-1">Asset Not Found</h2>
                <p className="text-sm text-slate-500">The scanned QR code does not match any asset in the system.</p>
            </div>
        </div>
    );

    const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
        ACTIVE: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
        INACTIVE: { icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-100' },
        UNDER_MAINTENANCE: { icon: Wrench, color: 'text-amber-700', bg: 'bg-amber-100' },
    };

    const status = statusConfig[asset.status] || statusConfig.ACTIVE;
    const StatusIcon = status.icon;

    const warrantyExpired = asset.warrantyExpiryDate && new Date(asset.warrantyExpiryDate) < new Date();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-8 px-4">
            <div className="max-w-md mx-auto space-y-4">
                {/* Header Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                            {asset.assetCode}
                        </span>
                        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {asset.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <h1 className="text-xl font-bold">{asset.name}</h1>
                    {asset.description && (
                        <p className="text-sm text-indigo-200 mt-1">{asset.description}</p>
                    )}
                </div>

                {/* Details Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Asset Details</h3>
                    <div className="space-y-3">
                        {[
                            { icon: Tag, label: 'Type', value: asset.assetType?.name },
                            { icon: Package, label: 'Brand', value: asset.brand?.name },
                            { icon: User, label: 'Assigned To', value: asset.assignedTo?.name },
                            { icon: MapPin, label: 'Branch', value: asset.branch?.name ? `${asset.branch.name}${asset.branch.city ? ` — ${asset.branch.city}` : ''}` : null },
                            { icon: Calendar, label: 'Purchase Date', value: asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('en-IN') : null },
                            { icon: Shield, label: 'Warranty Until', value: asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate).toLocaleDateString('en-IN') : null },
                        ].filter(item => item.value).map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                                    <item.icon className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">{item.label}</p>
                                    <p className="text-sm font-medium text-slate-700">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Warranty Warning */}
                    {warrantyExpired && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-700 font-medium">Warranty has expired</p>
                        </div>
                    )}
                </div>

                {/* Serial Number */}
                {asset.serialNumber && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <p className="text-xs text-slate-400 mb-1">Serial Number</p>
                        <p className="text-sm font-mono font-medium text-slate-800">{asset.serialNumber}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">Powered by AMS Pro</p>
                </div>
            </div>
        </div>
    );
}
