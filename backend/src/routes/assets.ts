import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// PUBLIC — no auth — used by QR scan (Fix 1B)
router.get('/public/:id', async (req, res: Response) => {
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, assetCode: true, name: true, description: true,
                serialNumber: true, status: true, purchaseDate: true,
                warrantyExpiryDate: true, location: true,
                assetType:  { select: { name: true } },
                brand:      { select: { name: true } },
                branch:     { select: { name: true, city: true } },
                assignedTo: { select: { name: true } },
            }
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        res.json({ success: true, data: asset });
    } catch {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.use(authenticate);

// Generate asset code (Fix 4: type-specific prefix)
const generateAssetCode = async (orgId: string, assetTypeId?: string | null): Promise<string> => {
    let prefix = 'AST';
    if (assetTypeId) {
        const atype = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
        if (atype?.codePrefix) prefix = atype.codePrefix;
    }
    // Count assets of this type to get sequence number
    const count = await prisma.asset.count({
        where: {
            organizationId: orgId,
            assetTypeId: assetTypeId || undefined,
        }
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// Auto-generate full depreciation schedule for an asset
async function generateDepreciationSchedule(assetId: string) {
    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { assetType: true }
    });
    if (!asset || !asset.purchasePrice || !asset.purchaseDate || !asset.assetType) return;

    const { purchasePrice, purchaseDate, assetType } = asset;
    const usefulLifeYears = assetType.usefulLifeYears || 5;
    const salvageValue = purchasePrice * ((assetType.salvageValuePercent || 10) / 100);
    const method = assetType.depreciationMethod || 'STRAIGHT_LINE';
    const months = usefulLifeYears * 12;

    // Clear old schedule
    await prisma.depreciationSchedule.deleteMany({ where: { assetId } });

    const dbRate = method === 'DECLINING_BALANCE'
        ? 1 - Math.pow(Math.max(salvageValue, 1) / purchasePrice, 1 / usefulLifeYears)
        : 0;

    let currentBV = purchasePrice;
    let cumDep = 0;
    const records = [];

    for (let m = 0; m < months; m++) {
        const startDate = new Date(purchaseDate);
        startDate.setMonth(startDate.getMonth() + m);
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + 1;

        let dep = 0;
        if (method === 'STRAIGHT_LINE') {
            dep = (purchasePrice - salvageValue) / months;
        } else if (method === 'DECLINING_BALANCE') {
            dep = currentBV * (dbRate / 12);
        } else if (method === 'SUM_OF_YEARS_DIGITS') {
            const syd = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
            const yearIndex = Math.floor(m / 12);
            const remainingLife = usefulLifeYears - yearIndex;
            const annualDep = (remainingLife / syd) * (purchasePrice - salvageValue);
            dep = annualDep / 12;
        } else {
            dep = (purchasePrice - salvageValue) / months;
        }

        const opening = currentBV;
        const closing = Math.max(parseFloat((currentBV - dep).toFixed(2)), salvageValue);
        const actualDep = parseFloat((opening - closing).toFixed(2));
        cumDep = parseFloat((cumDep + actualDep).toFixed(2));
        currentBV = closing;

        records.push({
            assetId,
            year,
            month,
            openingValue: parseFloat(opening.toFixed(2)),
            depreciationAmount: actualDep,
            closingValue: closing,
            cumulativeDepreciation: cumDep,
            method,
            rate: method === 'DECLINING_BALANCE' ? dbRate * 100 : 100 / usefulLifeYears,
        });
    }

    await prisma.depreciationSchedule.createMany({ data: records });
    // Update currentValue to closing value at end of schedule
    await prisma.asset.update({
        where: { id: assetId },
        data: { currentValue: records[records.length - 1]?.closingValue ?? purchasePrice }
    });
}

// List assets (paginated, filterable, sortable)
router.get('/', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
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
                    branch: { select: { id: true, name: true, city: true, pincode: true } },
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
router.get('/:id', checkPermission(PERMISSIONS.VIEW_ASSETS), async (req: AuthRequest, res: Response) => {
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
router.post('/', checkPermission(PERMISSIONS.EDIT_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;
        const assetCode = await generateAssetCode(orgId, data.assetTypeId || null);

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

        // Auto-generate depreciation schedule if we have price + assetType
        if (asset.purchasePrice > 0 && asset.assetTypeId) {
            try { await generateDepreciationSchedule(asset.id); } catch (e) { console.error('Dep gen error:', e); }
        }

        res.status(201).json({ success: true, data: asset });
    } catch (error) {
        console.error('Create asset error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update asset
router.put('/:id', checkPermission(PERMISSIONS.EDIT_ASSETS), async (req: AuthRequest, res: Response) => {
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

        // Regenerate depreciation if financial fields changed
        const FINANCIAL = ['purchasePrice', 'purchaseDate', 'assetTypeId'];
        if (FINANCIAL.some(f => req.body.hasOwnProperty(f)) && asset.purchasePrice > 0 && asset.assetTypeId) {
            try { await generateDepreciationSchedule(asset.id); } catch (e) { console.error('Dep gen error:', e); }
        }

        res.json({ success: true, data: asset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST /recalculate-depreciation — Recalculate with different method ───────
router.post('/:id/recalculate-depreciation', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { method } = req.body;
        const orgId = req.user!.organizationId;

        const asset = await prisma.asset.findFirst({
            where: { id, organizationId: orgId },
            include: { assetType: true }
        });

        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        if (!asset.purchasePrice || !asset.purchaseDate || !asset.assetType) {
            return res.status(400).json({ success: false, error: 'Asset missing price, date, or type for depreciation' });
        }

        // Temporarily update the asset type's method if different
        const originalMethod = asset.assetType.depreciationMethod;
        if (method && method !== originalMethod) {
            await prisma.assetType.update({
                where: { id: asset.assetType.id },
                data: { depreciationMethod: method }
            });
        }

        // Regenerate the full schedule
        await generateDepreciationSchedule(id);

        // Restore original method if we changed it
        if (method && method !== originalMethod) {
            await prisma.assetType.update({
                where: { id: asset.assetType.id },
                data: { depreciationMethod: originalMethod }
            });
        }

        // Fetch the refreshed data
        const updatedAsset = await prisma.asset.findUnique({
            where: { id },
            include: {
                assetType: true,
                depreciationSchedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] }
            }
        });

        res.json({
            success: true,
            message: 'Depreciation recalculated successfully',
            data: {
                method: method || originalMethod,
                scheduleCount: updatedAsset?.depreciationSchedule.length || 0,
                currentValue: updatedAsset?.currentValue || 0,
            }
        });
    } catch (error) {
        console.error('Error recalculating depreciation:', error);
        res.status(500).json({ success: false, error: 'Failed to recalculate depreciation' });
    }
});

// ── GET /depreciation-chart — Chart-ready depreciation data ──────────────────
router.get('/:id/depreciation-chart', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const orgId = req.user!.organizationId;

        const asset = await prisma.asset.findFirst({
            where: { id, organizationId: orgId },
            include: {
                assetType: true,
                depreciationSchedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] }
            }
        });

        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        const schedule = asset.depreciationSchedule;
        if (schedule.length === 0) {
            return res.status(404).json({ success: false, error: 'No depreciation data found' });
        }

        const salvageValue = asset.purchasePrice * ((asset.assetType?.salvageValuePercent ?? 10) / 100);

        // Calculate remaining useful life
        const today = new Date();
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : today;
        const monthsElapsed = (today.getFullYear() - purchaseDate.getFullYear()) * 12 +
                              (today.getMonth() - purchaseDate.getMonth());
        const totalMonths = (asset.assetType?.usefulLifeYears ?? 5) * 12;
        const remainingMonths = Math.max(0, totalMonths - monthsElapsed);

        const lastEntry = schedule[schedule.length - 1];
        const currentBookValue = lastEntry?.closingValue ?? asset.currentValue;
        const totalDepreciated = asset.purchasePrice - currentBookValue;

        res.json({
            success: true,
            data: {
                labels: schedule.map(s => `${String(s.month).padStart(2, '0')}/${s.year}`),
                bookValues: schedule.map(s => s.closingValue),
                accumulatedDepreciation: schedule.map(s => s.cumulativeDepreciation),
                monthlyDepreciation: schedule.map(s => s.depreciationAmount),
                meta: {
                    purchasePrice: asset.purchasePrice,
                    salvageValue,
                    usefulLifeYears: asset.assetType?.usefulLifeYears ?? 5,
                    method: schedule[0]?.method || 'STRAIGHT_LINE',
                    currentBookValue,
                    totalDepreciated,
                    depreciationPercentage: asset.purchasePrice > 0
                        ? Math.round((totalDepreciated / asset.purchasePrice) * 100)
                        : 0,
                    remainingMonths,
                    remainingYears: Math.round(remainingMonths / 12 * 10) / 10,
                    isFullyDepreciated: currentBookValue <= salvageValue,
                }
            }
        });
    } catch (error) {
        console.error('Error fetching depreciation chart:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch depreciation data' });
    }
});

// Bulk delete assets
router.post('/bulk-delete', checkPermission(PERMISSIONS.DELETE_ASSETS), async (req: AuthRequest, res: Response) => {
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
        const qrCodes = await prisma.qRCode.findMany({ where: { assetId: { in: validIds } }, select: { id: true } });
        const qrCodeIds = qrCodes.map(q => q.id);
        if (qrCodeIds.length > 0) {
            await prisma.qRCode.deleteMany({ where: { id: { in: qrCodeIds } } });
        }

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
router.delete('/:id', checkPermission(PERMISSIONS.DELETE_ASSETS), async (req: AuthRequest, res: Response) => {
    try {
        // Delete related QR code
        const qrCode = await prisma.qRCode.findUnique({ where: { assetId: req.params.id }, select: { id: true } });
        if (qrCode) {
            await prisma.qRCode.delete({ where: { id: qrCode.id } });
        }

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
