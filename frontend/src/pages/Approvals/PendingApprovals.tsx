import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, Eye, Check, XCircle, X, ChevronLeft, ChevronRight, PenTool } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState, useRef } from 'react';

// We use a simple canvas-based signature pad instead of react-signature-canvas
// to avoid external dependency issues. This is functionally equivalent.
function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);

    const getCtx = () => canvasRef.current?.getContext('2d');

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawingRef.current = true;
        const ctx = getCtx();
        if (!ctx) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const ctx = getCtx();
        if (!ctx) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const endDraw = () => { isDrawingRef.current = false; };

    const clear = () => {
        const ctx = getCtx();
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const isBlank = () => {
        if (!canvasRef.current) return true;
        const ctx = getCtx();
        if (!ctx) return true;
        const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) return false;
        }
        return true;
    };

    const save = () => {
        if (isBlank()) {
            toast.error('Please sign before approving');
            return;
        }
        const dataUrl = canvasRef.current!.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <PenTool className="w-4 h-4" /> Draw your signature below
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={clear}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>
                <div className="flex-1" />
                <button type="button" onClick={onCancel}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={save}
                    className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                    Sign & Approve
                </button>
            </div>
        </div>
    );
}

export default function PendingApprovals() {
    const queryClient = useQueryClient();
    const [viewingReport, setViewingReport] = useState<any>(null);
    const [detailPage, setDetailPage] = useState(1);
    const [showSignature, setShowSignature] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const { data: pendingData, isLoading } = useQuery({
        queryKey: ['pending-reports'],
        queryFn: () => api.get('/unit-reports/pending').then(r => r.data.data),
    });

    const { data: reportDetail } = useQuery({
        queryKey: ['unit-report-detail', viewingReport?.id, detailPage],
        queryFn: () => api.get(`/unit-reports/${viewingReport.id}?page=${detailPage}&limit=25`).then(r => r.data.data),
        enabled: !!viewingReport,
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, signatureImage }: { id: string; signatureImage: string }) =>
            api.put(`/unit-reports/${id}/approve`, { signatureImage }),
        onSuccess: () => {
            toast.success('Report approved!');
            queryClient.invalidateQueries({ queryKey: ['pending-reports'] });
            queryClient.invalidateQueries({ queryKey: ['unit-reports'] });
            setViewingReport(null); setShowSignature(false);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Approval failed'),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            api.put(`/unit-reports/${id}/reject`, { reason }),
        onSuccess: () => {
            toast.success('Report rejected');
            queryClient.invalidateQueries({ queryKey: ['pending-reports'] });
            queryClient.invalidateQueries({ queryKey: ['unit-reports'] });
            setViewingReport(null); setShowReject(false); setRejectReason('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Rejection failed'),
    });

    const pending = pendingData || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Pending Approvals</h1>
                <p className="text-slate-500 text-sm mt-1">Review and approve unit reports</p>
            </div>

            {/* Pending Count Badge */}
            {pending.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-800">{pending.length} report{pending.length !== 1 ? 's' : ''} awaiting your approval</p>
                        <p className="text-xs text-amber-600">Each report requires a digital signature for approval</p>
                    </div>
                </div>
            )}

            {/* Reports Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Unit/Branch</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Submitted By</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sent On</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : pending.length === 0 ? (
                            <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                                <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No pending approvals. You're all caught up!
                            </td></tr>
                        ) : pending.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                            <FileCheck className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-800">{r.unit?.name || '—'}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600">{r.createdBy?.name || '—'}</td>
                                <td className="px-5 py-3 text-sm text-slate-500">
                                    {r.sentAt ? new Date(r.sentAt).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => { setViewingReport(r); setDetailPage(1); setShowSignature(false); setShowReject(false); }}
                                            className="p-1.5 rounded-lg hover:bg-indigo-50" title="Review">
                                            <Eye className="w-4 h-4 text-indigo-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Report Detail + Approve/Reject Modal */}
            {viewingReport && reportDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl animate-fade-in mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">Review — {reportDetail.unit?.name}</h2>
                            <button onClick={() => setViewingReport(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Report Info */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Submitted By</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.createdBy?.name}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Total Assets</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.pagination?.total || 0}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Unit Location</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.unit?.location || reportDetail.unit?.city || '—'}</p>
                            </div>
                        </div>

                        {/* Assets Table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Asset</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Brand</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(reportDetail.assets || []).map((a: any) => (
                                        <tr key={a.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-slate-800 font-medium">{a.name}</td>
                                            <td className="px-4 py-2 text-slate-500 font-mono text-xs">{a.assetCode}</td>
                                            <td className="px-4 py-2 text-slate-600">{a.assetType?.name || '—'}</td>
                                            <td className="px-4 py-2 text-slate-600">{a.brand?.name || '—'}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    a.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}>{a.status}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-800">{a.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {reportDetail.pagination && reportDetail.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mb-6">
                                <p className="text-xs text-slate-500">
                                    Page {reportDetail.pagination.page} of {reportDetail.pagination.totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => setDetailPage(p => Math.max(1, p - 1))} disabled={detailPage <= 1}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDetailPage(p => Math.min(reportDetail.pagination.totalPages, p + 1))}
                                        disabled={detailPage >= reportDetail.pagination.totalPages}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Signature Area */}
                        {showSignature && (
                            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <SignaturePad
                                    onSave={(dataUrl) => {
                                        approveMutation.mutate({ id: viewingReport.id, signatureImage: dataUrl });
                                    }}
                                    onCancel={() => setShowSignature(false)}
                                />
                            </div>
                        )}

                        {/* Reject Area */}
                        {showReject && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                                <label className="block text-sm font-medium text-red-700">Rejection Reason *</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Explain why this report is being rejected..."
                                    className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-red-500/30 focus:outline-none"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setShowReject(false)}
                                        className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white">Cancel</button>
                                    <button
                                        onClick={() => {
                                            if (!rejectReason.trim()) return toast.error('Please provide a reason');
                                            rejectMutation.mutate({ id: viewingReport.id, reason: rejectReason });
                                        }}
                                        disabled={rejectMutation.isPending}
                                        className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                                    >
                                        {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {!showSignature && !showReject && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSignature(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium text-sm hover:opacity-90 shadow-md"
                                >
                                    <Check className="w-4 h-4" /> Approve with Signature
                                </button>
                                <button
                                    onClick={() => setShowReject(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-red-200 text-red-600 rounded-xl font-medium text-sm hover:bg-red-50"
                                >
                                    <XCircle className="w-4 h-4" /> Reject
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
