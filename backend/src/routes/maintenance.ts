import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// List maintenance logs
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const status = req.query.status as string;
        const type = req.query.type as string;
        const where: any = { organizationId: orgId };
        if (status) where.status = status;
        if (type) where.type = type;

        const logs = await prisma.maintenanceLog.findMany({
            where,
            include: {
                asset: { select: { id: true, name: true, assetCode: true } },
                technician: { select: { id: true, name: true } }
            },
            orderBy: { scheduledDate: 'desc' }
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Create maintenance log
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const data = req.body;
        if (!data.assetId || !data.type || !data.scheduledDate) {
            return res.status(400).json({ success: false, error: 'assetId, type, and scheduledDate are required' });
        }
        const log = await prisma.maintenanceLog.create({
            data: {
                assetId: data.assetId,
                type: data.type || 'PREVENTIVE',
                scheduledDate: new Date(data.scheduledDate),
                description: data.description || null,
                cost: parseFloat(data.cost) || 0,
                technicianId: data.technicianId || null,
                status: 'PENDING',
                organizationId: req.user!.organizationId
            },
            include: {
                asset: { select: { name: true, assetCode: true, serialNumber: true } },
                technician: { select: { name: true } }
            }
        });
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update maintenance log
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const existing = await prisma.maintenanceLog.findFirst({
            where: { id: req.params.id, organizationId: req.user!.organizationId }
        });
        if (!existing) return res.status(404).json({ success: false, error: 'Maintenance log not found' });

        const data = req.body;
        const updateData: any = {};
        if (data.type) updateData.type = data.type;
        if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
        if (data.description !== undefined) updateData.description = data.description;
        if (data.cost !== undefined) updateData.cost = parseFloat(data.cost);
        if (data.technicianId !== undefined) updateData.technicianId = data.technicianId;
        if (data.status) updateData.status = data.status;
        if (data.nextMaintenanceDate) updateData.nextMaintenanceDate = new Date(data.nextMaintenanceDate);

        const log = await prisma.maintenanceLog.update({
            where: { id: req.params.id },
            data: updateData,
            include: { asset: { select: { name: true } }, technician: { select: { name: true } } }
        });
        res.json({ success: true, data: log });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Complete maintenance
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
    try {
        const existing = await prisma.maintenanceLog.findFirst({
            where: { id: req.params.id, organizationId: req.user!.organizationId }
        });
        if (!existing) return res.status(404).json({ success: false, error: 'Maintenance log not found' });

        const { actualCost, completionNotes, nextMaintenanceDate } = req.body;
        // Build updated description: keep original + append completion notes
        const updatedDescription = completionNotes
            ? `${existing.description ? existing.description + '\n\n' : ''}✅ Completion Notes: ${completionNotes}`
            : existing.description;

        const log = await prisma.maintenanceLog.update({
            where: { id: req.params.id },
            data: {
                status: 'COMPLETED',
                completedDate: new Date(),
                cost: actualCost ? parseFloat(actualCost) : existing.cost,
                description: updatedDescription,
                nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null
            },
            include: { asset: { select: { name: true, assetCode: true } } }
        });

        res.json({ success: true, data: log });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete maintenance log
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const log = await prisma.maintenanceLog.findFirst({
            where: { id: req.params.id, organizationId: req.user!.organizationId }
        });
        if (!log) return res.status(404).json({ success: false, error: 'Maintenance log not found' });

        await prisma.maintenanceLog.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Maintenance log deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
