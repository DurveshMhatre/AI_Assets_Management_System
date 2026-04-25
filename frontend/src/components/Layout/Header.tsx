import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bell, Upload, Menu, LogOut, User, BookOpen, Upload as UploadIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ImportModal from '../Import/ImportModal';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Props {
    onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: Props) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [showImport, setShowImport] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserManual, setShowUserManual] = useState(false);
    const [manualFile, setManualFile] = useState<File | null>(null);

    const queryClient = useQueryClient();

    const { data: settingsData } = useQuery({
        queryKey: ['settings'],
        queryFn: () => api.get('/settings').then(r => r.data.data)
    });

    const manualUploadMutation = useMutation({
        mutationFn: async () => {
            if (!manualFile) return;
            const formData = new FormData();
            formData.append('file', manualFile);
            return api.post('/settings/manual', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },
        onSuccess: () => {
            toast.success('User manual uploaded');
            setManualFile(null);
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error || 'Upload failed');
        }
    });

    const { data: notifData } = useQuery({
        queryKey: ['report-notifications'],
        queryFn: () => api.get('/unit-reports/notifications/list').then(r => r.data.data),
        refetchInterval: 30000, // poll every 30s
    });

    const markReadMutation = useMutation({
        mutationFn: (id: string) => api.put(`/unit-reports/notifications/${id}/read`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-notifications'] }),
    });

    const markAllReadMutation = useMutation({
        mutationFn: () => api.put('/unit-reports/notifications/read-all'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-notifications'] }),
    });

    const unreadCount = notifData?.unreadCount || 0;
    const notifications = notifData?.notifications || [];

    const handleNotifClick = (n: any) => {
        if (!n.isRead) markReadMutation.mutate(n.id);
        setShowNotifications(false);
        navigate(n.type === 'REPORT_PENDING' ? '/approvals' : '/unit-reports');
    };

    const notifTypeLabel = (type: string) => {
        switch (type) {
            case 'REPORT_PENDING': return '📋 New report awaiting approval';
            case 'REPORT_APPROVED': return '✅ Your report was approved';
            case 'REPORT_REJECTED': return '❌ Your report was rejected';
            default: return 'Notification';
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={onToggleSidebar} className="p-2 rounded-lg hover:bg-slate-100 lg:hidden">
                        <Menu className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search assets, brands, suppliers..."
                            className="pl-10 pr-4 py-2 w-72 bg-slate-50 border border-slate-200 rounded-lg text-sm 
                focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 
              text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-indigo-500/25"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Upload Excel</span>
                    </button>

                    <button
                        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell className="w-5 h-5 text-slate-600" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center px-1">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setShowUserManual(true)}
                        className="hidden md:flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                        <BookOpen className="w-4 h-4" />
                        User Manual
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-700">{user?.name}</p>
                                <p className="text-xs text-slate-500">{user?.role}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 
                flex items-center justify-center text-white text-sm font-bold">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-fade-in">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <p className="text-sm font-medium">{user?.name}</p>
                                    <p className="text-xs text-slate-500">{user?.email}</p>
                                </div>
                                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                                    <User className="w-4 h-4" /> Profile
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <LogOut className="w-4 h-4" /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {showImport && <ImportModal onClose={() => setShowImport(false)} />}

            {/* Notifications dropdown */}
            {showNotifications && (
                <div className="fixed top-16 right-6 z-40 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 animate-fade-in">
                    <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Notifications</p>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                                    Mark all read
                                </button>
                            )}
                            <button onClick={() => setShowNotifications(false)} className="text-xs text-slate-500 hover:text-slate-700">
                                Close
                            </button>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400">
                                No notifications yet
                            </div>
                        ) : notifications.map((n: any) => (
                            <button
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                                    !n.isRead ? 'bg-indigo-50/50' : ''
                                }`}
                            >
                                <p className="text-sm text-slate-700">{notifTypeLabel(n.type)}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {n.report?.unit?.name} · {new Date(n.createdAt).toLocaleDateString('en-IN')}
                                </p>
                                {!n.isRead && <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full mt-1"></span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* User Manual modal */}
            {showUserManual && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-bold text-slate-900">AMS User Manual</h2>
                            </div>
                            <button onClick={() => setShowUserManual(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                ✕
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            This quick guide explains the main areas of the system. Share it with new users when onboarding.
                        </p>
                        <div className="space-y-3 text-sm text-slate-700">
                            <div>
                                <p className="font-semibold mb-1">1. Navigation</p>
                                <p>Use the left sidebar to move between Dashboard, Assets, Inventory, Maintenance, Depreciation, Reports, Masters (Types/Brands/Suppliers), Roles, and Settings.</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1">2. Assets</p>
                                <p>Create new assets using the “Add Asset” button on the Assets page. Click any asset in the list or cards to open full details, depreciation, and related info.</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1">3. Imports & Reports</p>
                                <p>Use “Upload Excel” in the top bar for bulk asset imports. Use the Reports page to download predefined Excel reports.</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1">4. BI Tools</p>
                                <p>BI Tools shows advanced visualizations for assets by branch, brand, type, and status. Switch tabs for different types of analysis.</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1">5. Settings & Roles</p>
                                <p>Admins can configure organization settings, asset code format, alerts, and manage user roles from the Roles and Settings sections.</p>
                            </div>
                        </div>
                        <div className="mt-5 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-slate-500">
                                    <p className="font-semibold text-slate-700 mb-1">Upload PDF manual</p>
                                    <p>Attach your detailed user guide as a PDF or Word file. It will be stored securely on the server.</p>
                                </div>
                                <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                                    <UploadIcon className="w-4 h-4" />
                                    <span>{manualFile ? manualFile.name : 'Choose file'}</span>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setManualFile(f || null);
                                        }}
                                    />
                                </label>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <button
                                    onClick={() => manualUploadMutation.mutate()}
                                    disabled={!manualFile || manualUploadMutation.isPending}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                                >
                                    {manualUploadMutation.isPending ? 'Uploading...' : 'Upload Manual'}
                                </button>
                                {settingsData?.settings?.userManualPath && (
                                    <a
                                        href={settingsData.settings.userManualPath}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        Open current manual
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
