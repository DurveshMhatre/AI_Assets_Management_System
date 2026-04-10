import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Assets from './pages/Assets/AssetList';
import AssetDetail from './pages/Assets/AssetDetail';
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
import QRApprovals from './pages/QRApprovals/QRApprovals';
import QRTracker from './pages/QRTracker/QRTracker';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Toaster position="top-right" toastOptions={{
                duration: 4000,
                style: { background: '#1E293B', color: '#F8FAFC', borderRadius: '10px' }
            }} />
            <Routes>
                <Route path="/login" element={<Login />} />
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
                    <Route path="qr-approvals" element={<QRApprovals />} />
                    <Route path="roles" element={<Roles />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
