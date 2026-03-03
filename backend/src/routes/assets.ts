import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// Generate asset code
const generateAssetCode = async (orgId: string): Promise<string> => {
    const count = await prisma.asset.count({ where: { organizationId: orgId } });
    return `AST-${String(count + 1).padStart(5, '0')}`;
};

// List assets (paginated, filterable, sortable)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const status = req.query.status as string;
        const branchId = req.query.branchId as string;
        const brandId = req.query.brandId as string;
        const assetTypeId = req.query.assetTypeId as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) || 'desc';

        const where: any = { organizationId: orgId };
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { assetCode: { contains: search } },
                { serialNumber: { contains: search } },
                { description: { contains: search } }
            ];
        }
        if (status) where.status = status;
        if (branchId) where.branchId = branchId;
        if (brandId) where.brandId = brandId;
        if (assetTypeId) where.assetTypeId = assetTypeId;

        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where,
                include: {
                    branch: { select: { id: true, name: true } },
                    brand: { select: { id: true, name: true } },
                    supplier: { select: { id: true, companyName: true } },
                    assetType: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma.asset.count({ where })
        ]);

        res.json({
            success: true,
            data: assets,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('List assets error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get single asset
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: req.params.id },
            include: {
                branch: true,
                brand: true,
                supplier: true,
                assetType: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                documents: true,
                maintenanceLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: { technician: { select: { name: true } } }
                },
                depreciationSchedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
                inventoryRecords: { include: { branch: { select: { name: true } } } }
            }
        });

        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        res.json({ success: true, data: asset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Create asset
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const assetCode = await generateAssetCode(orgId);
        const data = req.body;

        const asset = await prisma.asset.create({
            data: {
                assetCode,
                name: data.name,
                description: data.description,
                serialNumber: data.serialNumber,
                status: data.status || 'ACTIVE',
                purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
                purchasePrice: parseFloat(data.purchasePrice) || 0,
                currentValue: parseFloat(data.purchasePrice) || 0,
                warrantyExpiryDate: data.warrantyExpiryDate ? new Date(data.warrantyExpiryDate) : null,
                location: data.location,
                branchId: data.branchId || null,
                brandId: data.brandId || null,
                supplierId: data.supplierId || null,
                assetTypeId: data.assetTypeId || null,
                organizationId: orgId,
                assignedToUserId: data.assignedToUserId || null,
                photoUrl: data.photoUrl,
                companyPolicyNotes: data.companyPolicyNotes,
                quantity: parseInt(data.quantity) || 1,
                unit: data.unit,
                tags: data.tags ? JSON.stringify(data.tags) : '[]',
            },
            include: { branch: true, brand: true, supplier: true, assetType: true }
        });

        res.status(201).json({ success: true, data: asset });
    } catch (error) {
        console.error('Create asset error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update asset
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const data = req.body;
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
        if (data.purchasePrice !== undefined) updateData.purchasePrice = parseFloat(data.purchasePrice);
        if (data.currentValue !== undefined) updateData.currentValue = parseFloat(data.currentValue);
        if (data.warrantyExpiryDate !== undefined) updateData.warrantyExpiryDate = data.warrantyExpiryDate ? new Date(data.warrantyExpiryDate) : null;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.branchId !== undefined) updateData.branchId = data.branchId || null;
        if (data.brandId !== undefined) updateData.brandId = data.brandId || null;
        if (data.supplierId !== undefined) updateData.supplierId = data.supplierId || null;
        if (data.assetTypeId !== undefined) updateData.assetTypeId = data.assetTypeId || null;
        if (data.assignedToUserId !== undefined) updateData.assignedToUserId = data.assignedToUserId || null;
        if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
        if (data.companyPolicyNotes !== undefined) updateData.companyPolicyNotes = data.companyPolicyNotes;
        if (data.quantity !== undefined) updateData.quantity = parseInt(data.quantity);
        if (data.unit !== undefined) updateData.unit = data.unit;
        if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

        const asset = await prisma.asset.update({
            where: { id: req.params.id },
            data: updateData,
            include: { branch: true, brand: true, supplier: true, assetType: true, assignedTo: { select: { id: true, name: true } } }
        });

        res.json({ success: true, data: asset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Bulk delete assets
router.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or empty IDs array' });
        }

        const orgId = req.user!.organizationId;

        // Only delete assets that belong to this organization
        const assetsToDelete = await prisma.asset.findMany({
            where: { id: { in: ids }, organizationId: orgId },
            select: { id: true }
        });
        const validIds = assetsToDelete.map(a => a.id);

        if (validIds.length === 0) {
            return res.status(404).json({ success: false, error: 'No matching assets found' });
        }

        // Delete related records first, then assets
        await prisma.depreciationSchedule.deleteMany({ where: { assetId: { in: validIds } } });
        await prisma.maintenanceLog.deleteMany({ where: { assetId: { in: validIds } } });
        await prisma.inventoryRecord.deleteMany({ where: { assetId: { in: validIds } } });
        await prisma.document.deleteMany({ where: { assetId: { in: validIds } } });
        await prisma.asset.deleteMany({ where: { id: { in: validIds } } });

        res.json({ success: true, message: `${validIds.length} assets deleted successfully`, deleted: validIds.length });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete asset
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        // Delete related records first
        await prisma.depreciationSchedule.deleteMany({ where: { assetId: req.params.id } });
        await prisma.maintenanceLog.deleteMany({ where: { assetId: req.params.id } });
        await prisma.inventoryRecord.deleteMany({ where: { assetId: req.params.id } });
        await prisma.document.deleteMany({ where: { assetId: req.params.id } });
        await prisma.asset.delete({ where: { id: req.params.id } });

        res.json({ success: true, message: 'Asset deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get asset depreciation
router.get('/:id/depreciation', async (req: AuthRequest, res: Response) => {
    try {
        const schedules = await prisma.depreciationSchedule.findMany({
            where: { assetId: req.params.id },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });
        res.json({ success: true, data: schedules });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get asset maintenance
router.get('/:id/maintenance', async (req: AuthRequest, res: Response) => {
    try {
        const logs = await prisma.maintenanceLog.findMany({
            where: { assetId: req.params.id },
            orderBy: { createdAt: 'desc' },
            include: { technician: { select: { name: true } } }
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get asset documents
router.get('/:id/documents', async (req: AuthRequest, res: Response) => {
    try {
        const docs = await prisma.document.findMany({
            where: { assetId: req.params.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: docs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
