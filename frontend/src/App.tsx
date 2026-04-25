import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import Layout from './components/Layout/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Assets from './pages/Assets/AssetList';
import AssetDetail from './pages/Assets/AssetDetail';
import AssetScan from './pages/Assets/AssetScan';
import BiTools from './pages/BiTools/BiTools';
import Inventory from './pages/Inventory/Inventory';
import Maintenance from './pages/Maintenance/Maintenance';
import Depreciation from './pages/Depreciation/Depreciation';
import Reports from './pages/Reports/Reports';
import AssetTypes from './pages/AssetTypes/AssetTypes';
import Brands from './pages/Brands/Brands';
import Suppliers from './pages/Suppliers/Suppliers';
import Roles from './pages/Roles/Roles';
import Settings from './pages/Settings/Settings';
import QRTracker from './pages/QRTracker/QRTracker';
import UnitReports from './pages/Reports/UnitReports';
import PendingApprovals from './pages/Approvals/PendingApprovals';
import Users from './pages/Users/Users';
import AccessDenied from './pages/AccessDenied';
import api from './api/client';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

// Permission-guarded route wrapper
function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
    const hasPermission = useAuthStore((s) => s.hasPermission);
    if (!hasPermission(permission)) {
        return <AccessDenied />;
    }
    return <>{children}</>;
}

// Fetch permissions on mount
function PermissionLoader({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, setPermissions, accessToken } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && accessToken) {
            api.get('/users/me/permissions')
                .then((res) => {
                    if (res.data?.success) {
                        setPermissions(res.data.data);
                    }
                })
                .catch(() => { /* ignore — permissions will fallback */ });
        }
    }, [isAuthenticated, accessToken]);

    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <PermissionLoader>
                <Toaster position="top-right" toastOptions={{
                    duration: 4000,
                    style: { background: '#1E293B', color: '#F8FAFC', borderRadius: '10px' }
                }} />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    {/* Public route for QR scan (Fix 1B) */}
                    <Route path="/scan/:id" element={<AssetScan />} />
                    <Route path="/403" element={<AccessDenied />} />
                    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/dashboard" />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="assets" element={<Assets />} />
                        <Route path="assets/:id" element={<AssetDetail />} />
                        <Route path="bi-tools" element={<BiTools />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="maintenance" element={<Maintenance />} />
                        <Route path="depreciation" element={<Depreciation />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="asset-types" element={<AssetTypes />} />
                        <Route path="brands" element={<Brands />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="qr-tracker" element={<QRTracker />} />
                        <Route path="unit-reports" element={<PermissionRoute permission="VIEW_REPORTS"><UnitReports /></PermissionRoute>} />
                        <Route path="approvals" element={<PermissionRoute permission="APPROVE_REPORTS"><PendingApprovals /></PermissionRoute>} />
                        <Route path="users" element={<PermissionRoute permission="MANAGE_USERS"><Users /></PermissionRoute>} />
                        <Route path="roles" element={<PermissionRoute permission="MANAGE_ROLES"><Roles /></PermissionRoute>} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </PermissionLoader>
        </BrowserRouter>
    );
}
