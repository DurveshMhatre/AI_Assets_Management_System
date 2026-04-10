import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';

type Permission = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'execute';
type Feature = 'dashboard' | 'assets' | 'inventory' | 'maintenance' | 'depreciation' |
    'reports' | 'asset-types' | 'brands' | 'suppliers' | 'roles' | 'settings' |
    'import' | 'users' | 'qr';

const permissionMatrix: Record<string, Record<Feature, Permission[]>> = {
    ADMIN: {
        dashboard: ['view'],
        assets: ['view', 'create', 'edit', 'delete', 'export'],
        inventory: ['view', 'edit'],
        maintenance: ['view', 'create', 'edit', 'execute'],
        depreciation: ['view', 'execute'],
        reports: ['view', 'export'],
        'asset-types': ['view', 'create', 'edit', 'delete'],
        brands: ['view', 'create', 'edit', 'delete'],
        suppliers: ['view', 'create', 'edit', 'delete'],
        roles: ['view', 'create', 'edit', 'delete'],
        settings: ['view', 'edit'],
        import: ['view', 'execute'],
        users: ['view', 'create', 'edit', 'delete'],
        qr: ['view', 'create', 'edit', 'delete', 'execute'],
    },
    MANAGER: {
        dashboard: ['view'],
        assets: ['view', 'create', 'edit', 'export'],
        inventory: ['view', 'edit'],
        maintenance: ['view', 'create', 'edit', 'execute'],
        depreciation: ['view', 'execute'],
        reports: ['view', 'export'],
        'asset-types': ['view', 'create', 'edit'],
        brands: ['view', 'create', 'edit'],
        suppliers: ['view', 'create', 'edit'],
        roles: ['view'],
        settings: ['view'],
        import: ['view', 'execute'],
        users: ['view'],
        qr: ['view', 'create', 'edit', 'execute'],
    },
    TECHNICIAN: {
        dashboard: ['view'],
        assets: ['view'],
        inventory: ['view'],
        maintenance: ['view', 'create', 'edit', 'execute'],
        depreciation: ['view'],
        reports: ['view'],
        'asset-types': ['view'],
        brands: ['view'],
        suppliers: ['view'],
        roles: [],
        settings: [],
        import: ['view'],
        users: [],
        qr: ['view', 'create'],
    },
    VIEWER: {
        dashboard: ['view'],
        assets: ['view'],
        inventory: ['view'],
        maintenance: ['view'],
        depreciation: ['view'],
        reports: ['view'],
        'asset-types': ['view'],
        brands: ['view'],
        suppliers: ['view'],
        roles: [],
        settings: [],
        import: ['view'],
        users: [],
        qr: ['view'],
    }
};

export const checkPermission = (feature: Feature, permission: Permission) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const rolePerms = permissionMatrix[req.user.role];
        if (!rolePerms || !rolePerms[feature]?.includes(permission)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        next();
    };
};

export const getPermissionMatrix = () => permissionMatrix;
