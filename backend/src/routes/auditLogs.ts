import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const entity = req.query.entity as string;
        const where: any = { user: { organizationId: req.user!.organizationId } };
        if (entity) where.entity = entity;

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: { user: { select: { name: true, email: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ]);

        res.json({ success: true, data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
