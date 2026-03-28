import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, HelpCircle, FileSpreadsheet, XCircle, Brain, RefreshCw } from 'lucide-react';
import api from '../../api/client';

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
    assetName: 'Asset Name',
    description: 'Description',
    brand: 'Brand',
    supplier: 'Supplier',
    supplierEmail: 'Supplier Email',
    supplierPhone: 'Supplier Phone',
    supplierAddress: 'Supplier Address',
    city: 'City',
    pincode: 'Pincode',
    branch: 'Branch / Location',
    assetType: 'Asset Type',
    serialNumber: 'Serial Number',
    purchaseDate: 'Purchase Date',
    purchasePrice: 'Purchase Price',
    quantity: 'Quantity',
    status: 'Status',
    warrantyExpiry: 'Warranty Expiry',
    usefulLife: 'Useful Life (Years)',
    salvageValue: 'Salvage Value',
    depMethod: 'Depreciation Method',
    assignedTo: 'Assigned To',
    companyPolicy: 'Company Policy',
};

const REQUIRED_FIELDS = ['assetName', 'purchasePrice', 'purchaseDate'];

const NARROW_VISION_FIELDS = ['assetName', 'serialNumber', 'purchasePrice', 'purchaseDate'];

interface MappingSuggestion {
    excelHeader: string;
    confidence: number | string;
}

interface MappingResult {
    matched: Record<string, MappingSuggestion>;
    unmappedSystemFields: string[];
    unmatchedExcelColumns: string[];
    missingRequired: string[];
    allExcelHeaders: string[];
    averageConfidence?: number;
    requiresManualReview?: boolean;
}

interface UploadResult {
    headers: string[];
    previewRows: any[];
    totalRows: number;
    fileName: string;
    filePath?: string;
    mapping: MappingResult;
}

interface OrgStats {
    totalFeedbacks: number;
    correctMappings: number;
    avgConfidence: number;
    accuracyRate: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    uploadResult: UploadResult;
    onConfirm: (data: { finalMapping: Record<string, string>; filePath?: string }) => void;
}

function getConfidenceValue(conf: number | string): number {
    if (typeof conf === 'number') return conf;
    if (conf === 'EXACT') return 0.95;
    return 0;
}

export default function MappingWizard({ isOpen, onClose, uploadResult, onConfirm }: Props) {
    const { headers, previewRows, totalRows, fileName, filePath, mapping } = uploadResult;

    const [userMapping, setUserMapping] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const [field, info] of Object.entries(mapping.matched)) {
            initial[field] = info.excelHeader;
        }
        return initial;
    });

    const [feedback, setFeedback] = useState<Record<string, { wasCorrect: boolean }>>({});
    const [orgStats, setOrgStats] = useState<OrgStats | null>(null);

    // Unrecognized: ignore toggles
    const [ignored, setIgnored] = useState<Set<string>>(new Set());
    // Unrecognized: field assignment
    const [unrecognizedAssign, setUnrecognizedAssign] = useState<Record<string, string>>({});

    const [autoExpanded, setAutoExpanded] = useState(true);
    const [unrecogExpanded, setUnrecogExpanded] = useState(false);

    // Load org stats
    useEffect(() => {
        if (isOpen) {
            api.get('/import/stats')
                .then(r => setOrgStats(r.data.data))
                .catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFieldSelect = (field: string, value: string) => {
        setUserMapping(prev => ({ ...prev, [field]: value }));
    };

    const handleFeedbackToggle = (field: string, wasCorrect: boolean) => {
        setFeedback(prev => ({ ...prev, [field]: { wasCorrect } }));
    };

    const matchedCount = Object.keys(mapping.matched).length;
    const manualCount = mapping.unmappedSystemFields.length;

    const handleConfirm = async () => {
        const finalMapping: Record<string, string> = {};

        for (const [field, val] of Object.entries(userMapping)) {
            if (val && val !== '__skip__') finalMapping[field] = val;
        }

        for (const [col, sysField] of Object.entries(unrecognizedAssign)) {
            if (sysField && !ignored.has(col)) finalMapping[sysField] = col;
        }

        // Send feedback for learning
        const feedbackMappings = Object.entries(feedback).map(([field, fb]) => ({
            excelHeader: userMapping[field] || mapping.matched[field]?.excelHeader || '',
            systemField: field,
            wasCorrect: fb.wasCorrect,
            confidenceScore: mapping.matched[field] ? getConfidenceValue(mapping.matched[field].confidence) : 0,
        })).filter(m => m.excelHeader);

        if (feedbackMappings.length > 0) {
            try {
                await api.post('/import/feedback', { mappings: feedbackMappings });
            } catch (e) {
                console.error('Feedback submission failed:', e);
            }
        }

        onConfirm({ finalMapping, filePath });
    };

    const getConfidenceBadge = (field: string) => {
        const info = mapping.matched[field];
        if (!info) return null;

        const score = getConfidenceValue(info.confidence);
        const pct = Math.round(score * 100);

        if (score >= 0.8) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />{pct}%
                </span>
            );
        } else if (score >= 0.5) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    <AlertTriangle className="w-3 h-3" />{pct}%
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3" />{pct}%
                </span>
            );
        }
    };

    const avgConf = mapping.averageConfidence
        ? Math.round(mapping.averageConfidence * 100)
        : null;

    const SectionSelect = ({ field, value }: { field: string; value: string }) => (
        <select
            value={value}
            onChange={e => handleFieldSelect(field, e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
        >
            <option value="">Select Excel column…</option>
            {headers.map(h => (
                <option key={h} value={h}>{h}</option>
            ))}
            <option value="__skip__">— Skip this field —</option>
        </select>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <Brain className="w-6 h-6 text-indigo-600" />
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Intelligent Mapping Wizard</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{fileName} · {totalRows} rows · {headers.length} columns detected</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {orgStats && orgStats.totalFeedbacks > 0 && (
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Your Mapping Accuracy</p>
                                <p className="text-lg font-bold text-indigo-600">{orgStats.accuracyRate}%</p>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                    {/* Overall Confidence Bar */}
                    {avgConf !== null && (
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${
                            avgConf >= 70 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                            <span className="text-sm font-medium text-slate-700">
                                Overall Mapping Confidence: <strong className={avgConf >= 70 ? 'text-emerald-700' : 'text-amber-700'}>{avgConf}%</strong>
                            </span>
                            <div className="w-32 bg-white/60 rounded-full h-2.5">
                                <div
                                    className={`h-2.5 rounded-full transition-all ${avgConf >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${avgConf}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Manual Review Alert */}
                    {mapping.requiresManualReview && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800">
                                Some mappings have low confidence. Please review and confirm before proceeding.
                                Your corrections help improve future suggestions!
                            </p>
                        </div>
                    )}

                    {/* File Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your data preview:</p>
                        <div className="overflow-x-auto max-h-32 overflow-y-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100">
                                        {headers.slice(0, 8).map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 border border-slate-200 whitespace-nowrap">{h}</th>
                                        ))}
                                        {headers.length > 8 && <th className="px-3 py-2 text-slate-400 border border-slate-200">+{headers.length - 8} more</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((row, i) => (
                                        <tr key={i} className="hover:bg-white">
                                            {headers.slice(0, 8).map(h => (
                                                <td key={h} className="px-3 py-1.5 border border-slate-200 text-slate-700 truncate max-w-[140px]">
                                                    {String(row[h] ?? '')}
                                                </td>
                                            ))}
                                            {headers.length > 8 && <td className="px-3 py-1.5 border border-slate-200 text-slate-400">…</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 1: Auto-Detected */}
                    <div className="border border-green-200 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setAutoExpanded(v => !v)}
                            className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-800">
                                    ✅ {matchedCount} column{matchedCount !== 1 ? 's' : ''} auto-detected
                                </span>
                            </div>
                            {autoExpanded ? <ChevronDown className="w-4 h-4 text-green-600" /> : <ChevronRight className="w-4 h-4 text-green-600" />}
                        </button>
                        {autoExpanded && (
                            <div className="p-4 bg-green-50/40 space-y-3">
                                {Object.keys(mapping.matched).map(field => {
                                    const isRequired = REQUIRED_FIELDS.includes(field);
                                    const isNarrow = NARROW_VISION_FIELDS.includes(field);
                                    return (
                                        <div key={field} className={`p-3 rounded-lg border ${isRequired ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                                                    {FIELD_LABELS[field] || field}
                                                    {isRequired && <span className="text-red-500">*</span>}
                                                    {isNarrow && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-600">Critical</span>
                                                    )}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {getConfidenceBadge(field)}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <div className="flex-1">
                                                    <SectionSelect field={field} value={userMapping[field] ?? ''} />
                                                </div>
                                                {/* Feedback buttons */}
                                                <button
                                                    onClick={() => handleFeedbackToggle(field, true)}
                                                    className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                                                        feedback[field]?.wasCorrect === true
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'
                                                    }`}
                                                    title="Mark as correct"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleFeedbackToggle(field, false)}
                                                    className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                                                        feedback[field]?.wasCorrect === false
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600'
                                                    }`}
                                                    title="Mark as wrong"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Needs Attention */}
                    {mapping.unmappedSystemFields.length > 0 && (
                        <div className="border border-amber-200 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 p-4 bg-amber-50">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <span className="font-semibold text-amber-800">
                                    ⚠️ {manualCount} field{manualCount !== 1 ? 's' : ''} need manual mapping
                                </span>
                            </div>
                            <div className="p-4 bg-amber-50/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {mapping.unmappedSystemFields.map(field => {
                                    const isRequired = REQUIRED_FIELDS.includes(field);
                                    const val = userMapping[field] ?? '';
                                    return (
                                        <div key={field}>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                {FIELD_LABELS[field] || field}
                                                {isRequired && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <SectionSelect field={field} value={val} />
                                            {isRequired && !val && (
                                                <p className="text-xs text-red-500 mt-1">Required — import may fail without this</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section 3: Unrecognized Columns */}
                    {mapping.unmatchedExcelColumns.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setUnrecogExpanded(v => !v)}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-slate-400" />
                                    <span className="font-semibold text-slate-600">
                                        ❓ {mapping.unmatchedExcelColumns.length} unrecognized column{mapping.unmatchedExcelColumns.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {unrecogExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                            {unrecogExpanded && (
                                <div className="p-4 space-y-3">
                                    {mapping.unmatchedExcelColumns.map(col => (
                                        <div key={col} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-slate-700 w-40 truncate">{col}</span>
                                            <select
                                                value={ignored.has(col) ? '__ignore__' : (unrecognizedAssign[col] || '')}
                                                onChange={e => {
                                                    if (e.target.value === '__ignore__') {
                                                        setIgnored(prev => new Set([...prev, col]));
                                                        setUnrecognizedAssign(prev => { const n = { ...prev }; delete n[col]; return n; });
                                                    } else {
                                                        setIgnored(prev => { const n = new Set(prev); n.delete(col); return n; });
                                                        setUnrecognizedAssign(prev => ({ ...prev, [col]: e.target.value }));
                                                    }
                                                }}
                                                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                                            >
                                                <option value="">Assign to field…</option>
                                                {Object.keys(FIELD_LABELS).map(f => (
                                                    <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                                                ))}
                                                <option value="__ignore__">— Ignore this column —</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Unmapped headers info */}
                    {mapping.unmatchedExcelColumns.length > 0 && !unrecogExpanded && (
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500">
                                <strong>{mapping.unmatchedExcelColumns.length}</strong> Excel columns will not be imported: {mapping.unmatchedExcelColumns.slice(0, 5).join(', ')}{mapping.unmatchedExcelColumns.length > 5 ? '...' : ''}
                            </p>
                        </div>
                    )}
                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3 rounded-b-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            🟢 {matchedCount + Object.keys(userMapping).filter(k => !mapping.matched[k] && userMapping[k] && userMapping[k] !== '__skip__').length} matched
                        </span>
                        {manualCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                🟡 {manualCount} manual
                            </span>
                        )}
                        {Object.keys(feedback).length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                📝 {Object.keys(feedback).length} feedback
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-md shadow-indigo-500/25 whitespace-nowrap"
                        >
                            Confirm Mapping &amp; Import →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
