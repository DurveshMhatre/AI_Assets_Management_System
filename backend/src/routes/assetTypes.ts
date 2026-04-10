import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ── Helper: calculate annual depreciation rate ──────────────────────────
function calcAnnualDepRate(method: string, usefulLife: number, salvagePct: number): number {
    if (usefulLife <= 0) return 0;
    if (method === 'STRAIGHT_LINE') {
        return Math.round(((100 - salvagePct) / usefulLife) * 100) / 100;
    }
    if (method === 'DECLINING_BALANCE') {
        const rate = (1 - Math.pow(salvagePct / 100, 1 / usefulLife)) * 100;
        return Math.round(rate * 100) / 100;
    }
    // SUM_OF_YEARS_DIGITS — first-year effective rate
    const syd = (usefulLife * (usefulLife + 1)) / 2;
    const firstYearFraction = usefulLife / syd;
    return Math.round(firstYearFraction * (100 - salvagePct) * 100) / 100;
}

// ── GET / — List approved types (all roles) + all for ADMIN/MANAGER ─────
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const role = req.user!.role;
        const showAll = role === 'ADMIN' || role === 'MANAGER';

        const types = await prisma.assetType.findMany({
            where: {
                organizationId: orgId,
                ...(showAll ? {} : { status: 'approved' }),
            },
            include: {
                brand: { select: { name: true } },
                createdBy: { select: { name: true } },
                reviewedBy: { select: { name: true } },
                _count: { select: { assets: true } },
            },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: types });
    } catch (error) {
        console.error('List asset types error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /pending — List pending types (ADMIN/MANAGER only) ──────────────
router.get('/pending', async (req: AuthRequest, res: Response) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        const types = await prisma.assetType.findMany({
            where: { organizationId: req.user!.organizationId, status: 'pending_review' },
            include: {
                brand: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { assets: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: types });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST / — Create asset type (auto-approved for ADMIN/MANAGER) ────────
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user!.role;
        const autoApprove = role === 'ADMIN' || role === 'MANAGER';
        const { name, description, depreciationMethod, usefulLifeYears, salvageValuePercent, brandId } = req.body;

        const method = depreciationMethod || 'STRAIGHT_LINE';
        const life = parseInt(usefulLifeYears) || 5;
        const salvage = parseFloat(salvageValuePercent) || 10;
        const depRate = calcAnnualDepRate(method, life, salvage);

        const type = await prisma.assetType.create({
            data: {
                name,
                description: description || null,
                depreciationMethod: method,
                usefulLifeYears: life,
                salvageValuePercent: salvage,
                annualDepreciationRate: depRate,
                status: autoApprove ? 'approved' : 'pending_review',
                createdById: req.user!.id,
                ...(autoApprove ? { reviewedById: req.user!.id, reviewedAt: new Date() } : {}),
                brandId: brandId || null,
                organizationId: req.user!.organizationId,
            },
        });
        res.status(201).json({ success: true, data: type });
    } catch (error) {
        console.error('Create asset type error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST /request — Request new type (any role, pending_review) ─────────
router.post('/request', async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, depreciationMethod, usefulLifeYears, salvageValuePercent, brandId } = req.body;

        const method = depreciationMethod || 'STRAIGHT_LINE';
        const life = parseInt(usefulLifeYears) || 5;
        const salvage = parseFloat(salvageValuePercent) || 10;
        const depRate = calcAnnualDepRate(method, life, salvage);

        const type = await prisma.assetType.create({
            data: {
                name,
                description: description || null,
                depreciationMethod: method,
                usefulLifeYears: life,
                salvageValuePercent: salvage,
                annualDepreciationRate: depRate,
                status: 'pending_review',
                createdById: req.user!.id,
                brandId: brandId || null,
                organizationId: req.user!.organizationId,
            },
        });
        res.status(201).json({ success: true, data: type, message: 'Submitted for review' });
    } catch (error) {
        console.error('Request asset type error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id — Update type ──────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, depreciationMethod, usefulLifeYears, salvageValuePercent, brandId } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (brandId !== undefined) updateData.brandId = brandId || null;
        if (depreciationMethod !== undefined) updateData.depreciationMethod = depreciationMethod;
        if (usefulLifeYears !== undefined) updateData.usefulLifeYears = parseInt(usefulLifeYears);
        if (salvageValuePercent !== undefined) updateData.salvageValuePercent = parseFloat(salvageValuePercent);

        // Recalculate dep rate if relevant fields changed
        if (depreciationMethod || usefulLifeYears || salvageValuePercent) {
            const existing = await prisma.assetType.findUnique({ where: { id: req.params.id } });
            if (existing) {
                const m = depreciationMethod || existing.depreciationMethod;
                const l = usefulLifeYears ? parseInt(usefulLifeYears) : existing.usefulLifeYears;
                const s = salvageValuePercent ? parseFloat(salvageValuePercent) : existing.salvageValuePercent;
                updateData.annualDepreciationRate = calcAnnualDepRate(m, l, s);
            }
        }

        const type = await prisma.assetType.update({ where: { id: req.params.id }, data: updateData });
        res.json({ success: true, data: type });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id/approve — Approve pending type (ADMIN/MANAGER) ─────────────
router.put('/:id/approve', async (req: AuthRequest, res: Response) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        const type = await prisma.assetType.update({
            where: { id: req.params.id },
            data: {
                status: 'approved',
                reviewedById: req.user!.id,
                reviewedAt: new Date(),
                rejectionReason: null,
            },
        });
        res.json({ success: true, data: type, message: 'Asset type approved' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id/reject — Reject pending type (ADMIN/MANAGER) ──────────────
router.put('/:id/reject', async (req: AuthRequest, res: Response) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        const { reason } = req.body;
        const type = await prisma.assetType.update({
            where: { id: req.params.id },
            data: {
                status: 'rejected',
                reviewedById: req.user!.id,
                reviewedAt: new Date(),
                rejectionReason: reason || 'No reason provided',
            },
        });
        res.json({ success: true, data: type, message: 'Asset type rejected' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── DELETE /:id — Delete type ───────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const count = await prisma.asset.count({ where: { assetTypeId: req.params.id } });
        if (count > 0) return res.status(400).json({ success: false, error: `Cannot delete: ${count} assets linked` });
        await prisma.assetType.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
