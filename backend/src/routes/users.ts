import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { checkPermission, clearPermissionCache, getUserPermissions } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// GET /api/users — List all users (include roleId and role name)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { organizationId: req.user!.organizationId },
            select: {
                id: true, name: true, email: true, role: true, roleId: true,
                isActive: true, lastLogin: true, createdAt: true,
                userRole: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, data: users });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// GET /api/users/me/permissions — Get current user's permissions
router.get('/me/permissions', async (req: AuthRequest, res: Response) => {
    try {
        const perms = await getUserPermissions(req.user!.id, req.user!.role, req.user!.roleId);
        res.json({ success: true, data: perms });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// POST /api/users — Create user
router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, role, roleId } = req.body;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ success: false, error: 'Email already exists' });

        // If roleId provided, look up the role name to sync
        let roleName = role || 'VIEWER';
        if (roleId) {
            const dbRole = await prisma.role.findUnique({ where: { id: roleId } });
            if (dbRole) roleName = dbRole.name;
        }

        const hashedPassword = await bcrypt.hash(password || 'Password@123', 10);
        const user = await prisma.user.create({
            data: {
                name, email, password: hashedPassword,
                role: roleName,
                roleId: roleId || null,
                organizationId: req.user!.organizationId,
            }
        });
        res.status(201).json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, roleId: user.roleId } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// PUT /api/users/:id — Update user
router.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, role, isActive } = req.body;
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (email !== undefined) {
            const existing = await prisma.user.findFirst({ where: { email, id: { not: req.params.id } } });
            if (existing) return res.status(400).json({ success: false, error: 'Email already in use' });
            updateData.email = email;
        }
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: { id: true, name: true, email: true, role: true, roleId: true, isActive: true }
        });
        res.json({ success: true, data: user });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// PUT /api/users/:id/role — Assign a role to a user
router.put('/:id/role', checkPermission(PERMISSIONS.MANAGE_USERS), async (req: AuthRequest, res: Response) => {
    try {
        const { roleId } = req.body;

        if (!roleId) {
            return res.status(400).json({ success: false, error: 'roleId is required' });
        }

        // Validate the role exists
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Update both roleId and role string (keep in sync)
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                roleId: role.id,
                role: role.name,
            },
            select: {
                id: true, name: true, email: true, role: true, roleId: true, isActive: true,
                userRole: { select: { id: true, name: true } },
            },
        });

        // Clear permission cache for this user
        clearPermissionCache(req.params.id);

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// DELETE /api/users/:id — Deactivate user
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        if (req.params.id === req.user!.id) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ success: true, message: 'User deactivated' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
