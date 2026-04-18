import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { organizationId: req.user!.organizationId },
            select: { id: true, name: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, data: users });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, role } = req.body;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ success: false, error: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password || 'Password@123', 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role: role || 'VIEWER', organizationId: req.user!.organizationId }
        });
        res.status(201).json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

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
            select: { id: true, name: true, email: true, role: true, isActive: true }
        });
        res.json({ success: true, data: user });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        if (req.params.id === req.user!.id) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ success: true, message: 'User deactivated' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
