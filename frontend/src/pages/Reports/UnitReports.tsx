import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Send, Eye, X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
};

export default function UnitReports() {
    const queryClient = useQueryClient();
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [viewingReport, setViewingReport] = useState<any>(null);
    const [detailPage, setDetailPage] = useState(1);

    const { data: reportsData, isLoading } = useQuery({
        queryKey: ['unit-reports'],
        queryFn: () => api.get('/unit-reports').then(r => r.data.data),
    });

    const { data: branchesData } = useQuery({
        queryKey: ['branches-for-reports'],
        queryFn: () => api.get('/settings/branches').then(r => r.data.data || []),
        enabled: showNewModal,
    });

    const { data: reportDetail } = useQuery({
        queryKey: ['unit-report-detail', viewingReport?.id, detailPage],
        queryFn: () => api.get(`/unit-reports/${viewingReport.id}?page=${detailPage}&limit=25`).then(r => r.data.data),
        enabled: !!viewingReport,
    });

    const createMutation = useMutation({
        mutationFn: (data: { unitId: string }) => api.post('/unit-reports', data),
        onSuccess: () => {
            toast.success('Report created!');
            queryClient.invalidateQueries({ queryKey: ['unit-reports'] });
            setShowNewModal(false); setSelectedUnitId('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Create failed'),
    });

    const sendMutation = useMutation({
        mutationFn: (id: string) => api.put(`/unit-reports/${id}/send`),
        onSuccess: () => {
            toast.success('Report sent for approval!');
            queryClient.invalidateQueries({ queryKey: ['unit-reports'] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Send failed'),
    });

    const reports = reportsData || [];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Unit Reports</h1>
                    <p className="text-slate-500 text-sm mt-1">Generate and manage unit asset reports</p>
                </div>
                <button onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-md">
                    <Plus className="w-4 h-4" /> New Report
                </button>
            </div>

            {/* Reports Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Unit/Branch</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Created By</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Created</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Approved By</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"></div></td></tr>
                        )) : reports.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No reports yet. Create your first unit report.
                            </td></tr>
                        ) : reports.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-800">{r.unit?.name || '—'}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600">{r.createdBy?.name || '—'}</td>
                                <td className="px-5 py-3">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-500">
                                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600">{r.approver?.name || '—'}</td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => { setViewingReport(r); setDetailPage(1); }}
                                            className="p-1.5 rounded-lg hover:bg-indigo-50" title="View">
                                            <Eye className="w-4 h-4 text-indigo-500" />
                                        </button>
                                        {r.status === 'draft' && (
                                            <button onClick={() => sendMutation.mutate(r.id)}
                                                className="p-1.5 rounded-lg hover:bg-emerald-50" title="Send for Approval">
                                                <Send className="w-4 h-4 text-emerald-500" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* New Report Modal */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">New Unit Report</h2>
                            <button onClick={() => setShowNewModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Unit/Branch *</label>
                                <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:outline-none">
                                    <option value="">— Select Branch —</option>
                                    {(branchesData || []).map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (!selectedUnitId) return toast.error('Please select a branch');
                                    createMutation.mutate({ unitId: selectedUnitId });
                                }}
                                disabled={createMutation.isPending}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 shadow-md disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Detail Modal */}
            {viewingReport && reportDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl animate-fade-in mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none">
                        <div className="flex items-center justify-between mb-5 print:hidden">
                            <h2 className="text-lg font-bold">Unit Report — {reportDetail.unit?.name}</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrint}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700">
                                    <Printer className="w-4 h-4" /> Print / PDF
                                </button>
                                <button onClick={() => setViewingReport(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {/* Report Header */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Status</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mt-1 inline-block ${STATUS_STYLES[reportDetail.status] || ''}`}>
                                    {reportDetail.status}
                                </span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Created By</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.createdBy?.name}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Total Assets</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.pagination?.total || 0}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-500">Approver</p>
                                <p className="text-sm font-medium text-slate-800 mt-0.5">{reportDetail.approver?.name || '—'}</p>
                            </div>
                        </div>

                        {/* Signature Image (if approved) */}
                        {reportDetail.signatureImage && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <p className="text-xs text-emerald-600 font-semibold mb-2">Digital Signature</p>
                                <img src={reportDetail.signatureImage} alt="Approver signature" className="max-h-20 border border-emerald-200 rounded bg-white" />
                                <p className="text-xs text-emerald-500 mt-1">
                                    Approved by {reportDetail.approver?.name} on {reportDetail.approvedAt ? new Date(reportDetail.approvedAt).toLocaleDateString('en-IN') : ''}
                                </p>
                            </div>
                        )}

                        {/* Rejection Reason */}
                        {reportDetail.rejectionReason && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-xs text-red-600 font-semibold mb-1">Rejection Reason</p>
                                <p className="text-sm text-red-700">{reportDetail.rejectionReason}</p>
                            </div>
                        )}

                        {/* Assets Table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
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
                            <div className="flex items-center justify-between mt-4 print:hidden">
                                <p className="text-xs text-slate-500">
                                    Page {reportDetail.pagination.page} of {reportDetail.pagination.totalPages}
                                    {' '}({reportDetail.pagination.total} assets)
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                                        disabled={detailPage <= 1}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDetailPage(p => Math.min(reportDetail.pagination.totalPages, p + 1))}
                                        disabled={detailPage >= reportDetail.pagination.totalPages}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
