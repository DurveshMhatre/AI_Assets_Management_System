import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PermissionKey, PERMISSIONS } from '../constants/permissions';

const prisma = new PrismaClient();

// Legacy hardcoded permission matrix — used as fallback when user has no roleId
type LegacyPermission = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'execute';
type LegacyFeature = 'dashboard' | 'assets' | 'inventory' | 'maintenance' | 'depreciation' |
    'reports' | 'asset-types' | 'brands' | 'suppliers' | 'roles' | 'settings' |
    'import' | 'users' | 'qr';

const legacyPermissionMatrix: Record<string, Record<LegacyFeature, LegacyPermission[]>> = {
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

// Map new permission keys to legacy feature+permission for fallback
const permissionToLegacy: Record<string, { feature: LegacyFeature; permissions: LegacyPermission[] }> = {
    VIEW_ASSETS: { feature: 'assets', permissions: ['view'] },
    EDIT_ASSETS: { feature: 'assets', permissions: ['create', 'edit'] },
    DELETE_ASSETS: { feature: 'assets', permissions: ['delete'] },
    VIEW_INVENTORY: { feature: 'inventory', permissions: ['view'] },
    EDIT_INVENTORY: { feature: 'inventory', permissions: ['edit'] },
    VIEW_REPORTS: { feature: 'reports', permissions: ['view'] },
    APPROVE_REPORTS: { feature: 'reports', permissions: ['export'] },
    VIEW_MAINTENANCE: { feature: 'maintenance', permissions: ['view'] },
    EDIT_MAINTENANCE: { feature: 'maintenance', permissions: ['create', 'edit'] },
    VIEW_DEPRECIATION: { feature: 'depreciation', permissions: ['view'] },
    MANAGE_BRANDS: { feature: 'brands', permissions: ['create', 'edit', 'delete'] },
    MANAGE_SUPPLIERS: { feature: 'suppliers', permissions: ['create', 'edit', 'delete'] },
    MANAGE_ASSET_TYPES: { feature: 'asset-types', permissions: ['create', 'edit', 'delete'] },
    MANAGE_ROLES: { feature: 'roles', permissions: ['create', 'edit', 'delete'] },
    MANAGE_USERS: { feature: 'users', permissions: ['create', 'edit', 'delete'] },
    VIEW_SETTINGS: { feature: 'settings', permissions: ['view'] },
    EDIT_SETTINGS: { feature: 'settings', permissions: ['edit'] },
    IMPORT_DATA: { feature: 'import', permissions: ['execute'] },
    MANAGE_QR: { feature: 'qr', permissions: ['create', 'edit', 'delete', 'execute'] },
};

// Simple in-memory TTL cache for user permissions (60s)
const permissionCache = new Map<string, { permissions: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Get all permission strings for a user.
 * If the user has a roleId, queries the DB. Otherwise falls back to legacy matrix.
 */
export async function getUserPermissions(userId: string, role: string, roleId?: string): Promise<string[]> {
    // Check cache
    const cacheKey = `${userId}-${roleId || role}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.permissions;
    }

    let permissions: string[] = [];

    if (roleId) {
        // DB-backed: fetch from RolePermission table
        const rolePerms = await prisma.rolePermission.findMany({
            where: { roleId },
            select: { permission: true },
        });
        permissions = rolePerms.map(rp => rp.permission);
    } else {
        // Legacy fallback: convert hardcoded matrix to permission keys
        const roleMatrix = legacyPermissionMatrix[role];
        if (roleMatrix) {
            for (const [permKey, mapping] of Object.entries(permissionToLegacy)) {
                const featurePerms = roleMatrix[mapping.feature];
                if (featurePerms && mapping.permissions.some(p => featurePerms.includes(p))) {
                    permissions.push(permKey);
                }
            }
        }
    }

    // Cache the result
    permissionCache.set(cacheKey, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
    return permissions;
}

/**
 * Middleware: Check if the authenticated user has a specific permission.
 * Uses DB-backed roles if available, falls back to legacy hardcoded matrix.
 */
export const checkPermission = (permission: PermissionKey) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const userPerms = await getUserPermissions(req.user.id, req.user.role, req.user.roleId);

        // Cache permissions on the request object for reuse within the same request
        (req as any)._permissions = userPerms;

        if (!userPerms.includes(permission)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        next();
    };
};

/** Clear the permission cache for a specific user (call after role changes) */
export function clearPermissionCache(userId?: string) {
    if (userId) {
        for (const key of permissionCache.keys()) {
            if (key.startsWith(userId)) {
                permissionCache.delete(key);
            }
        }
    } else {
        permissionCache.clear();
    }
}

// Keep backward compatibility export
export const getPermissionMatrix = () => legacyPermissionMatrix;
