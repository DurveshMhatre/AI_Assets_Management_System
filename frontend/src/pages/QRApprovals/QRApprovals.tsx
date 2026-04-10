import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Check, XCircle, Clock, Eye, X } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function QRApprovals() {
    const queryClient = useQueryClient();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [viewQR, setViewQR] = useState<any>(null);

    const { data: pending, isLoading } = useQuery({
        queryKey: ['qr-pending'],
        queryFn: () => api.get('/qr/pending').then(r => r.data.data),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => api.put(`/qr/approve/${id}`),
        onSuccess: () => {
            toast.success('QR Approved!');
            queryClient.invalidateQueries({ queryKey: ['qr-pending'] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Approval failed'),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            api.put(`/qr/reject/${id}`, { reason }),
        onSuccess: () => {
            toast.success('QR Rejected');
            queryClient.invalidateQueries({ queryKey: ['qr-pending'] });
            setRejectId(null);
            setRejectReason('');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">QR Code Approvals</h1>
                <p className="text-slate-500 text-sm mt-1">Review and approve QR code sticker requests</p>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-indigo-100">Pending Approvals</p>
                        <p className="text-3xl font-bold">{pending?.length || 0}</p>
                    </div>
                </div>
            </div>

            {/* Pending Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Serial</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Submitted</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last Action</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}><td colSpan={5} className="px-5 py-4">
                                <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
                            </td></tr>
                        )) : !pending?.length ? (
                            <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                                <QrCode className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No pending QR approvals
                            </td></tr>
                        ) : pending.map((qr: any) => (
                            <tr key={qr.id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                    <p className="text-sm font-medium text-slate-800">{qr.asset?.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{qr.asset?.assetCode}</p>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600 font-mono">
                                    {qr.asset?.serialNumber || '—'}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-500">
                                    {qr.submittedAt ? new Date(qr.submittedAt).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="px-5 py-3">
                                    {qr.approvalLogs?.[0] && (
                                        <div>
                                            <p className="text-xs text-slate-600">{qr.approvalLogs[0].action}</p>
                                            <p className="text-xs text-slate-400">by {qr.approvalLogs[0].user?.name}</p>
                                        </div>
                                    )}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => setViewQR(qr)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100" title="Preview">
                                            <Eye className="w-4 h-4 text-slate-500" />
                                        </button>
                                        <button onClick={() => approveMutation.mutate(qr.id)}
                                            disabled={approveMutation.isPending}
                                            className="p-1.5 rounded-lg hover:bg-emerald-50" title="Approve">
                                            <Check className="w-4 h-4 text-emerald-600" />
                                        </button>
                                        <button onClick={() => setRejectId(qr.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-50" title="Reject">
                                            <XCircle className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* QR Preview Modal */}
            {viewQR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">QR Preview</h2>
                            <button onClick={() => setViewQR(null)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl text-center">
                            <QrCode className="w-24 h-24 mx-auto text-indigo-600 mb-3" />
                            <p className="text-sm font-medium text-slate-800">{viewQR.asset?.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{viewQR.asset?.assetCode}</p>
                        </div>
                        <pre className="mt-3 p-3 bg-slate-100 rounded-lg text-xs text-slate-600 overflow-auto max-h-32">
                            {JSON.stringify(JSON.parse(viewQR.qrData || '{}'), null, 2)}
                        </pre>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => { approveMutation.mutate(viewQR.id); setViewQR(null); }}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                                Approve
                            </button>
                            <button onClick={() => { setRejectId(viewQR.id); setViewQR(null); }}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in mx-4">
                        <h2 className="text-lg font-bold mb-4">Rejection Reason</h2>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Why is this QR being rejected?"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-red-500/30 focus:outline-none" />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                            <button onClick={() => rejectMutation.mutate({ id: rejectId, reason: rejectReason })}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
