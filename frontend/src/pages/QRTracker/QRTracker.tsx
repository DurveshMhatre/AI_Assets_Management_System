import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Plus, Printer, CheckCircle2, ArrowRight, Package } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

const COLUMNS = [
    { key: 'NO_QR', label: 'No QR', color: 'border-slate-300', bg: 'bg-slate-50', icon: Package },
    { key: 'DRAFT', label: 'Draft', color: 'border-blue-300', bg: 'bg-blue-50', icon: QrCode },
    { key: 'PENDING_APPROVAL', label: 'Pending', color: 'border-amber-300', bg: 'bg-amber-50', icon: QrCode },
    { key: 'APPROVED', label: 'Approved', color: 'border-emerald-300', bg: 'bg-emerald-50', icon: CheckCircle2 },
    { key: 'PRINTED', label: 'Printed', color: 'border-purple-300', bg: 'bg-purple-50', icon: Printer },
    { key: 'APPLIED', label: 'Applied', color: 'border-indigo-300', bg: 'bg-indigo-50', icon: CheckCircle2 },
];

interface AssetCard {
    id: string;
    assetId: string;
    name: string;
    assetCode: string;
    serialNumber?: string;
    status: string;
    qrId?: string;
}

export default function QRTracker() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['qr-all'],
        queryFn: () => api.get('/qr/all').then(r => r.data.data),
    });

    const generateMutation = useMutation({
        mutationFn: (assetId: string) => api.post(`/qr/generate/${assetId}`),
        onSuccess: () => {
            toast.success('QR generated!');
            queryClient.invalidateQueries({ queryKey: ['qr-all'] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Generation failed'),
    });

    const submitMutation = useMutation({
        mutationFn: (qrId: string) => api.post(`/qr/submit/${qrId}`),
        onSuccess: () => {
            toast.success('Submitted for approval!');
            queryClient.invalidateQueries({ queryKey: ['qr-all'] });
            queryClient.invalidateQueries({ queryKey: ['qr-pending'] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Submit failed'),
    });

    const printMutation = useMutation({
        mutationFn: (qrId: string) => api.put(`/qr/mark-printed/${qrId}`),
        onSuccess: () => {
            toast.success('Marked as printed');
            queryClient.invalidateQueries({ queryKey: ['qr-all'] });
        },
    });

    const applyMutation = useMutation({
        mutationFn: (qrId: string) => api.put(`/qr/mark-applied/${qrId}`),
        onSuccess: () => {
            toast.success('Marked as applied!');
            queryClient.invalidateQueries({ queryKey: ['qr-all'] });
        },
    });

    // Build columns data
    const columns: Record<string, AssetCard[]> = {
        NO_QR: [], DRAFT: [], PENDING_APPROVAL: [], APPROVED: [], PRINTED: [], APPLIED: [], REJECTED: [],
    };

    if (data) {
        // Assets without QR
        (data.assetsWithoutQR || []).forEach((a: any) => {
            columns.NO_QR.push({
                id: a.id, assetId: a.id, name: a.name,
                assetCode: a.assetCode, serialNumber: a.serialNumber,
                status: 'NO_QR',
            });
        });
        // QRs grouped by status
        (data.qrs || []).forEach((qr: any) => {
            const col = columns[qr.status] || columns.DRAFT;
            col.push({
                id: qr.id, assetId: qr.assetId, qrId: qr.id,
                name: qr.asset?.name || 'Unknown', assetCode: qr.asset?.assetCode || '',
                serialNumber: qr.asset?.serialNumber, status: qr.status,
            });
        });
    }

    const getAction = (card: AssetCard) => {
        switch (card.status) {
            case 'NO_QR':
                return {
                    label: 'Generate QR', icon: Plus,
                    onClick: () => generateMutation.mutate(card.assetId),
                    color: 'bg-blue-600 hover:bg-blue-700',
                };
            case 'DRAFT':
                return {
                    label: 'Submit', icon: ArrowRight,
                    onClick: () => submitMutation.mutate(card.qrId!),
                    color: 'bg-amber-600 hover:bg-amber-700',
                };
            case 'APPROVED':
                return {
                    label: 'Mark Printed', icon: Printer,
                    onClick: () => printMutation.mutate(card.qrId!),
                    color: 'bg-purple-600 hover:bg-purple-700',
                };
            case 'PRINTED':
                return {
                    label: 'Mark Applied', icon: CheckCircle2,
                    onClick: () => applyMutation.mutate(card.qrId!),
                    color: 'bg-indigo-600 hover:bg-indigo-700',
                };
            default:
                return null;
        }
    };

    // Stats
    const totalAssets = Object.values(columns).reduce((s, c) => s + c.length, 0);
    const applied = columns.APPLIED?.length || 0;
    const coverage = totalAssets > 0 ? Math.round((applied / totalAssets) * 100) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">QR Code Tracker</h1>
                    <p className="text-slate-500 text-sm mt-1">Track QR sticker lifecycle from generation to application</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white rounded-xl p-3 shadow-sm border text-center min-w-[80px]">
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="text-lg font-bold text-slate-800">{totalAssets}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm border text-center min-w-[80px]">
                        <p className="text-xs text-slate-400">Coverage</p>
                        <p className="text-lg font-bold text-emerald-600">{coverage}%</p>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            {isLoading ? (
                <div className="grid grid-cols-6 gap-3">
                    {COLUMNS.map(c => (
                        <div key={c.key} className="bg-slate-100 rounded-xl p-3 animate-pulse h-64"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {COLUMNS.map(col => {
                        const cards = columns[col.key] || [];
                        const ColIcon = col.icon;
                        return (
                            <div key={col.key} className={`rounded-xl border-2 ${col.color} ${col.bg} p-3 min-h-[200px]`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <ColIcon className="w-4 h-4 text-slate-600" />
                                    <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                                    <span className="ml-auto text-xs px-1.5 py-0.5 bg-white rounded-full font-medium text-slate-500 shadow-sm">
                                        {cards.length}
                                    </span>
                                </div>

                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {cards.map(card => {
                                        const action = getAction(card);
                                        return (
                                            <div key={card.id} className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                                <p className="text-xs font-medium text-slate-800 truncate">{card.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{card.assetCode}</p>
                                                {action && (
                                                    <button
                                                        onClick={action.onClick}
                                                        className={`mt-2 w-full flex items-center justify-center gap-1 py-1 text-white rounded text-[10px] font-medium ${action.color}`}
                                                    >
                                                        <action.icon className="w-3 h-3" /> {action.label}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {cards.length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-4">Empty</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
