import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import MappingWizard from './MappingWizard';

interface Props {
    onClose: () => void;
}

export default function ImportModal({ onClose }: Props) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [progress, setProgress] = useState(0);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const f = acceptedFiles[0];
        if (!f) return;
        setFile(f);

        try {
            const formData = new FormData();
            formData.append('file', f);
            const res = await api.post('/import/upload-preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadResult(res.data.data);
            setShowWizard(true);
        } catch (err: any) {
            toast.error('Failed to read file: ' + (err?.response?.data?.error || err.message));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] },
        maxSize: 50 * 1024 * 1024,
        multiple: false
    });

    const handleWizardConfirm = async ({ finalMapping, filePath }: { finalMapping: Record<string, string>; filePath?: string }) => {
        setShowWizard(false);
        if (!file) return;
        setImporting(true);
        setStep(3);

        const interval = setInterval(() => {
            setProgress(p => Math.min(p + Math.random() * 15, 90));
        }, 500);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('columnMapping', JSON.stringify(finalMapping));
            const res = await api.post('/import/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            clearInterval(interval);
            setProgress(100);
            setResult(res.data.data);
            setStep(4);
            toast.success('Import completed!');
        } catch (err: any) {
            clearInterval(interval);
            toast.error(err.response?.data?.error || 'Import failed');
            setStep(1);
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const res = await api.get('/templates/download', { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'asset-import-template.xlsx';
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Template downloaded!');
        } catch {
            toast.error('Download failed');
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in mx-4">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Import Assets from Excel</h2>
                            <p className="text-sm text-slate-500 mt-1">Step {step} of 4</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 h-1">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-1 transition-all duration-500"
                            style={{ width: `${step * 25}%` }}></div>
                    </div>

                    <div className="p-6">
                        {/* Step 1: Upload */}
                        {step === 1 && (
                            <>
                                <div
                                    {...getRootProps()}
                                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                      ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}
                                >
                                    <input {...getInputProps()} />
                                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                                    <p className="text-lg font-medium text-slate-700">
                                        {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file'}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">or click to browse • .xlsx, .csv • Max 50MB</p>
                                    <p className="text-xs text-slate-400 mt-3 bg-indigo-50 rounded-lg p-2">
                                        ✨ Smart column detection will automatically map your columns
                                    </p>
                                </div>
                                <button onClick={downloadTemplate}
                                    className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                    <Download className="w-4 h-4" /> Download Template
                                </button>
                            </>
                        )}

                        {/* Step 3: Progress */}
                        {step === 3 && (
                            <div className="text-center py-8">
                                <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Importing Assets...</h3>
                                <p className="text-slate-500 mb-6">Please wait while we process your file</p>
                                <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}></div>
                                </div>
                                <p className="text-sm text-slate-500">{Math.round(progress)}% complete</p>
                            </div>
                        )}

                        {/* Step 4: Summary */}
                        {step === 4 && result && (
                            <>
                                <div className="text-center mb-6">
                                    <CheckCircle className="w-16 h-16 mx-auto mb-3 text-emerald-500" />
                                    <h3 className="text-xl font-bold text-slate-800">Import Complete!</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="p-4 bg-emerald-50 rounded-xl">
                                        <p className="text-2xl font-bold text-emerald-700">{result.assetsCreated}</p>
                                        <p className="text-sm text-emerald-600">Assets Created</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl">
                                        <p className="text-2xl font-bold text-blue-700">{result.brandsCreated}</p>
                                        <p className="text-sm text-blue-600">Brands Created</p>
                                    </div>
                                    <div className="p-4 bg-purple-50 rounded-xl">
                                        <p className="text-2xl font-bold text-purple-700">{result.suppliersCreated}</p>
                                        <p className="text-sm text-purple-600">Suppliers Created</p>
                                    </div>
                                    <div className="p-4 bg-amber-50 rounded-xl">
                                        <p className="text-2xl font-bold text-amber-700">{result.branchesCreated}</p>
                                        <p className="text-sm text-amber-600">Branches Created</p>
                                    </div>
                                </div>

                                {result.errors?.length > 0 && (
                                    <div className="mb-4 p-4 bg-red-50 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                            <span className="font-medium text-red-700">{result.errorRows} rows had errors</span>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto text-sm text-red-600 space-y-1">
                                            {result.errors.slice(0, 10).map((e: any, i: number) => (
                                                <p key={i}>Row {e.row}: {e.error}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button onClick={onClose}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm">
                                    Done
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mapping Wizard overlay */}
            {showWizard && uploadResult && (
                <MappingWizard
                    isOpen={showWizard}
                    onClose={() => { setShowWizard(false); setStep(1); setFile(null); }}
                    uploadResult={uploadResult}
                    onConfirm={handleWizardConfirm}
                />
            )}
        </>
    );
}
