import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// List all tender types for organization
router.get('/', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const tenderTypes = await prisma.tenderType.findMany({
            where: { organizationId: orgId },
            include: {
                _count: { select: { tenders: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, data: tenderTypes });
    } catch (error) {
        console.error('List tender types error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Create tender type
router.post('/', checkPermission(PERMISSIONS.MANAGE_TENDER_TYPES), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        const nameLower = name.trim().toLowerCase();

        // Check for duplicate
        const existing = await prisma.tenderType.findUnique({
            where: { organizationId_nameLower: { organizationId: orgId, nameLower } }
        });
        if (existing) {
            return res.status(409).json({ success: false, error: 'Tender type with this name already exists' });
        }

        const tenderType = await prisma.tenderType.create({
            data: {
                name: name.trim(),
                nameLower,
                description: description || null,
                organizationId: orgId,
            }
        });

        res.status(201).json({ success: true, data: tenderType });
    } catch (error) {
        console.error('Create tender type error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update tender type
router.put('/:id', checkPermission(PERMISSIONS.MANAGE_TENDER_TYPES), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { name, description } = req.body;

        const existing = await prisma.tenderType.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Tender type not found' });
        }

        const updateData: any = {};
        if (name !== undefined) {
            updateData.name = name.trim();
            updateData.nameLower = name.trim().toLowerCase();
        }
        if (description !== undefined) updateData.description = description;

        const tenderType = await prisma.tenderType.update({
            where: { id: req.params.id },
            data: updateData,
        });

        res.json({ success: true, data: tenderType });
    } catch (error) {
        console.error('Update tender type error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete tender type (only if no tenders linked)
router.delete('/:id', checkPermission(PERMISSIONS.MANAGE_TENDER_TYPES), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const tenderType = await prisma.tenderType.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { _count: { select: { tenders: true } } }
        });

        if (!tenderType) {
            return res.status(404).json({ success: false, error: 'Tender type not found' });
        }

        if (tenderType._count.tenders > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: ${tenderType._count.tenders} tender(s) are using this type. Reassign them first.`
            });
        }

        await prisma.tenderType.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Tender type deleted' });
    } catch (error) {
        console.error('Delete tender type error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
