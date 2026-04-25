import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Package, BarChart3, Boxes, Wrench,
    TrendingDown, FileText, Tags, Award, Truck,
    Shield, Settings, ChevronLeft, ChevronRight, Sparkles,
    QrCode, Users, FileCheck, ClipboardCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { PERMISSIONS } from '../../constants/permissions';

interface Props {
    collapsed: boolean;
    onToggle: () => void;
}

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/bi-tools', icon: BarChart3, label: 'BI Tools' },
    { to: '/assets', icon: Package, label: 'Assets', permission: PERMISSIONS.VIEW_ASSETS },
    { to: '/inventory', icon: Boxes, label: 'Inventory', permission: PERMISSIONS.VIEW_INVENTORY },
    { to: '/maintenance', icon: Wrench, label: 'Maintenance', permission: PERMISSIONS.VIEW_MAINTENANCE },
    { to: '/depreciation', icon: TrendingDown, label: 'Depreciation', permission: PERMISSIONS.VIEW_DEPRECIATION },
    { to: '/reports', icon: FileText, label: 'Reports', permission: PERMISSIONS.VIEW_REPORTS },
    { to: '/asset-types', icon: Tags, label: 'Asset Types' },
    { to: '/brands', icon: Award, label: 'Brands' },
    { to: '/suppliers', icon: Truck, label: 'Suppliers' },
    { to: '/qr-tracker', icon: QrCode, label: 'QR Tracker', permission: PERMISSIONS.MANAGE_QR },
    { to: '/unit-reports', icon: FileCheck, label: 'Unit Reports', permission: PERMISSIONS.VIEW_REPORTS },
    { to: '/approvals', icon: ClipboardCheck, label: 'Pending Approvals', permission: PERMISSIONS.APPROVE_REPORTS },
    { to: '/users', icon: Users, label: 'Users', permission: PERMISSIONS.MANAGE_USERS },
    { to: '/roles', icon: Shield, label: 'Roles & Access', permission: PERMISSIONS.MANAGE_ROLES },
    { to: '/settings', icon: Settings, label: 'Settings', permission: PERMISSIONS.VIEW_SETTINGS },
];

export default function Sidebar({ collapsed, onToggle }: Props) {
    const hasPermission = useAuthStore((s) => s.hasPermission);

    const visibleNavItems = navItems.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(item.permission);
    });

    return (
        <aside className={`fixed top-0 left-0 h-screen bg-navy-900 text-white z-40 
      transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-60'}`}>
            {/* Logo */}
            <div className="flex items-center h-16 px-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 
            flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    {!collapsed && (
                        <span className="text-lg font-bold bg-gradient-to-r from-white to-indigo-200 
              bg-clip-text text-transparent whitespace-nowrap">
                            AMS Pro
                        </span>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
                <ul className="space-y-1 px-2">
                    {visibleNavItems.map((item) => (
                        <li key={item.to}>
                            <NavLink
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${isActive
                                        ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                    } ${collapsed ? 'justify-center' : ''}`
                                }
                                title={item.label}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && (
                                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Collapse toggle */}
            <button
                onClick={onToggle}
                className="flex items-center justify-center h-12 border-t border-white/10 
          hover:bg-white/5 transition-colors"
            >
                {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
        </aside>
    );
}
