import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// List all tenders for organization (paginated, searchable)
router.get('/', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string;

        const where: any = { organizationId: orgId };
        if (search) {
            where.OR = [
                { tenderNumber: { contains: search } },
                { tenderName: { contains: search } },
                { financialYear: { contains: search } },
            ];
        }

        const [tenders, total] = await Promise.all([
            prisma.tender.findMany({
                where,
                include: {
                    tenderType: { select: { id: true, name: true } },
                    _count: { select: { assets: true } },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.tender.count({ where }),
        ]);

        res.json({
            success: true,
            data: tenders,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List tenders error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get single tender with aggregated stats
router.get('/:id', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const tender = await prisma.tender.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: {
                tenderType: { select: { id: true, name: true } },
                _count: { select: { assets: true } },
            },
        });

        if (!tender) {
            return res.status(404).json({ success: false, error: 'Tender not found' });
        }

        // Calculate aggregate values
        const aggregates = await prisma.asset.aggregate({
            where: { tenderId: tender.id },
            _sum: { purchasePrice: true, currentValue: true },
            _count: true,
        });

        res.json({
            success: true,
            data: {
                ...tender,
                aggregates: {
                    totalAssets: aggregates._count,
                    totalPurchaseValue: aggregates._sum.purchasePrice || 0,
                    totalCurrentValue: aggregates._sum.currentValue || 0,
                },
            },
        });
    } catch (error) {
        console.error('Get tender error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get assets belonging to a specific tender
router.get('/:id/assets', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        // Verify tender belongs to org
        const tender = await prisma.tender.findFirst({
            where: { id: req.params.id, organizationId: orgId },
        });
        if (!tender) {
            return res.status(404).json({ success: false, error: 'Tender not found' });
        }

        const where = { tenderId: tender.id, organizationId: orgId };

        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where,
                include: {
                    branch: { select: { id: true, name: true, city: true, pincode: true } },
                    brand: { select: { id: true, name: true } },
                    supplier: { select: { id: true, companyName: true } },
                    assetType: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.asset.count({ where }),
        ]);

        res.json({
            success: true,
            data: assets,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Get tender assets error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Create tender
router.post('/', checkPermission(PERMISSIONS.MANAGE_TENDERS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { tenderNumber, tenderName, tenderTypeId, finalBillValue, financialYear } = req.body;

        if (!tenderNumber || !tenderNumber.trim()) {
            return res.status(400).json({ success: false, error: 'Tender number is required' });
        }
        if (!tenderName || !tenderName.trim()) {
            return res.status(400).json({ success: false, error: 'Tender name is required' });
        }

        const tenderNumberLower = tenderNumber.trim().toLowerCase();

        // Check for duplicate
        const existing = await prisma.tender.findUnique({
            where: { organizationId_tenderNumberLower: { organizationId: orgId, tenderNumberLower } }
        });
        if (existing) {
            return res.status(409).json({ success: false, error: 'Tender with this number already exists' });
        }

        // Validate tenderTypeId if provided
        if (tenderTypeId) {
            const typeExists = await prisma.tenderType.findFirst({
                where: { id: tenderTypeId, organizationId: orgId }
            });
            if (!typeExists) {
                return res.status(400).json({ success: false, error: 'Invalid tender type' });
            }
        }

        const tender = await prisma.tender.create({
            data: {
                tenderNumber: tenderNumber.trim(),
                tenderNumberLower,
                tenderName: tenderName.trim(),
                tenderTypeId: tenderTypeId || null,
                finalBillValue: parseFloat(finalBillValue) || 0,
                financialYear: financialYear || null,
                organizationId: orgId,
            },
            include: {
                tenderType: { select: { id: true, name: true } },
            },
        });

        res.status(201).json({ success: true, data: tender });
    } catch (error) {
        console.error('Create tender error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update tender
router.put('/:id', checkPermission(PERMISSIONS.MANAGE_TENDERS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { tenderNumber, tenderName, tenderTypeId, finalBillValue, financialYear } = req.body;

        const existing = await prisma.tender.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Tender not found' });
        }

        const updateData: any = {};
        if (tenderNumber !== undefined) {
            updateData.tenderNumber = tenderNumber.trim();
            updateData.tenderNumberLower = tenderNumber.trim().toLowerCase();
        }
        if (tenderName !== undefined) updateData.tenderName = tenderName.trim();
        if (tenderTypeId !== undefined) updateData.tenderTypeId = tenderTypeId || null;
        if (finalBillValue !== undefined) updateData.finalBillValue = parseFloat(finalBillValue) || 0;
        if (financialYear !== undefined) updateData.financialYear = financialYear || null;

        const tender = await prisma.tender.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                tenderType: { select: { id: true, name: true } },
                _count: { select: { assets: true } },
            },
        });

        res.json({ success: true, data: tender });
    } catch (error) {
        console.error('Update tender error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete tender (only if no linked assets)
router.delete('/:id', checkPermission(PERMISSIONS.MANAGE_TENDERS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const tender = await prisma.tender.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { _count: { select: { assets: true } } },
        });

        if (!tender) {
            return res.status(404).json({ success: false, error: 'Tender not found' });
        }

        if (tender._count.assets > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: ${tender._count.assets} asset(s) are linked to this tender. Remove them first.`,
            });
        }

        await prisma.tender.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Tender deleted' });
    } catch (error) {
        console.error('Delete tender error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
