import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission, getPermissionMatrix, clearPermissionCache } from '../middleware/permissions';
import { PERMISSIONS, ALL_PERMISSIONS } from '../constants/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// GET /api/roles — List all roles with permissions and user count
router.get('/', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                permissions: { select: { id: true, permission: true } },
                _count: { select: { users: true } },
            },
            orderBy: { name: 'asc' },
        });

        // Also include legacy matrix for backward compat
        const matrix = getPermissionMatrix();

        res.json({
            success: true,
            data: {
                roles: roles.map(r => ({
                    ...r,
                    userCount: r._count.users,
                    _count: undefined,
                })),
                matrix,
                availablePermissions: ALL_PERMISSIONS,
            },
        });
    } catch (error) {
        console.error('List roles error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /api/roles/:id/permissions — Get permissions for a specific role
router.get('/:id/permissions', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const role = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: { permissions: { select: { permission: true } } },
        });
        if (!role) return res.status(404).json({ success: false, error: 'Role not found' });

        res.json({
            success: true,
            data: {
                roleId: role.id,
                roleName: role.name,
                permissions: role.permissions.map(p => p.permission),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// POST /api/roles — Create new role
router.post('/', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, permissions } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Role name is required' });
        }

        // Check name uniqueness
        const existing = await prisma.role.findUnique({ where: { name: name.trim().toUpperCase() } });
        if (existing) {
            return res.status(409).json({ success: false, error: `Role "${name}" already exists` });
        }

        // Validate permissions if provided
        if (permissions && Array.isArray(permissions)) {
            const invalid = permissions.filter((p: string) => !ALL_PERMISSIONS.includes(p as any));
            if (invalid.length > 0) {
                return res.status(400).json({ success: false, error: `Invalid permissions: ${invalid.join(', ')}` });
            }
        }

        const role = await prisma.role.create({
            data: {
                name: name.trim().toUpperCase(),
                description: description || null,
                isSystem: false,
                permissions: permissions && Array.isArray(permissions) ? {
                    create: permissions.map((p: string) => ({ permission: p })),
                } : undefined,
            },
            include: {
                permissions: { select: { id: true, permission: true } },
                _count: { select: { users: true } },
            },
        });

        res.status(201).json({
            success: true,
            data: { ...role, userCount: role._count.users },
        });
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PUT /api/roles/:id — Update role name/description
router.put('/:id', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;

        const existing = await prisma.role.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ success: false, error: 'Role not found' });

        const updateData: any = {};
        if (name !== undefined) {
            const normalizedName = name.trim().toUpperCase();
            // Check uniqueness (excluding self)
            const dup = await prisma.role.findFirst({
                where: { name: normalizedName, id: { not: req.params.id } },
            });
            if (dup) return res.status(409).json({ success: false, error: `Role "${name}" already exists` });
            updateData.name = normalizedName;
        }
        if (description !== undefined) updateData.description = description || null;

        const role = await prisma.role.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                permissions: { select: { id: true, permission: true } },
                _count: { select: { users: true } },
            },
        });

        clearPermissionCache();

        res.json({
            success: true,
            data: { ...role, userCount: role._count.users },
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PUT /api/roles/:id/permissions — Replace full permission set
router.put('/:id/permissions', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, error: 'permissions must be an array of strings' });
        }

        const role = await prisma.role.findUnique({ where: { id: req.params.id } });
        if (!role) return res.status(404).json({ success: false, error: 'Role not found' });

        // Validate all permission strings
        const invalid = permissions.filter((p: string) => !ALL_PERMISSIONS.includes(p as any));
        if (invalid.length > 0) {
            return res.status(400).json({ success: false, error: `Invalid permissions: ${invalid.join(', ')}` });
        }

        // Replace: delete all existing, create new set
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId: req.params.id } }),
            ...permissions.map((p: string) =>
                prisma.rolePermission.create({ data: { roleId: req.params.id, permission: p } })
            ),
        ]);

        clearPermissionCache();

        const updated = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: {
                permissions: { select: { id: true, permission: true } },
                _count: { select: { users: true } },
            },
        });

        res.json({
            success: true,
            data: { ...updated, userCount: updated?._count?.users ?? 0 },
        });
    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// DELETE /api/roles/:id — Delete role
router.delete('/:id', checkPermission(PERMISSIONS.MANAGE_ROLES), async (req: AuthRequest, res: Response) => {
    try {
        const role = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { users: true } } },
        });

        if (!role) return res.status(404).json({ success: false, error: 'Role not found' });

        if (role.isSystem) {
            return res.status(400).json({ success: false, error: 'Cannot delete system roles' });
        }

        if (role._count.users > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: ${role._count.users} users assigned to this role`,
            });
        }

        // Delete permissions first (cascade should handle, but be explicit)
        await prisma.rolePermission.deleteMany({ where: { roleId: req.params.id } });
        await prisma.role.delete({ where: { id: req.params.id } });

        clearPermissionCache();

        res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
