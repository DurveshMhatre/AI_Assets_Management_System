import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';
import { toTitleCase } from '../utils/assetHelpers';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            where: { organizationId: req.user!.organizationId },
            include: { _count: { select: { assets: true } } },
            orderBy: { companyName: 'asc' }
        });
        res.json({ success: true, data: suppliers });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// Check duplicate supplier name (case-insensitive)
router.get('/check-duplicate', async (req: AuthRequest, res: Response) => {
    try {
        const name = req.query.name as string;
        const excludeId = req.query.excludeId as string;
        if (!name) return res.json({ exists: false });

        const companyNameLower = name.toLowerCase().trim();
        const where: any = {
            companyNameLower,
            organizationId: req.user!.organizationId,
        };
        if (excludeId) where.NOT = { id: excludeId };

        const existing = await prisma.supplier.findFirst({ where });
        if (existing) {
            res.json({ exists: true, canonical: { id: existing.id, name: existing.companyName } });
        } else {
            res.json({ exists: false });
        }
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const supplier = await prisma.supplier.findUnique({
            where: { id: req.params.id },
            include: { assets: { include: { assetType: true, brand: true } }, _count: { select: { assets: true } } }
        });
        if (!supplier) return res.status(404).json({ success: false, error: 'Not found' });

        const totalValue = await prisma.asset.aggregate({
            where: { supplierId: req.params.id },
            _sum: { purchasePrice: true }
        });

        res.json({ success: true, data: { ...supplier, totalAssetValue: totalValue._sum.purchasePrice || 0 } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.post('/', checkPermission(PERMISSIONS.MANAGE_SUPPLIERS), async (req: AuthRequest, res: Response) => {
    try {
        const { companyName, contactPerson, email, phone, address, city, pincode, website } = req.body;
        if (!companyName || !companyName.trim()) return res.status(400).json({ success: false, error: 'Company name is required' });

        const normalized = toTitleCase(companyName);
        const companyNameLower = normalized.toLowerCase();

        // Check for duplicates
        const existing = await prisma.supplier.findFirst({
            where: { companyNameLower, organizationId: req.user!.organizationId }
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: `A supplier named "${existing.companyName}" already exists`,
                canonical: { id: existing.id, name: existing.companyName }
            });
        }

        const supplier = await prisma.supplier.create({
            data: { companyName: normalized, companyNameLower, contactPerson, email, phone, address, city, pincode, website, organizationId: req.user!.organizationId }
        });
        res.status(201).json({ success: true, data: supplier });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:id', checkPermission(PERMISSIONS.MANAGE_SUPPLIERS), async (req: AuthRequest, res: Response) => {
    try {
        const { companyName, contactPerson, email, phone, address, city, pincode, website } = req.body;
        const updateData: any = {};

        if (companyName !== undefined) {
            const normalized = toTitleCase(companyName);
            const companyNameLower = normalized.toLowerCase();

            // Check for duplicates (excluding self)
            const existing = await prisma.supplier.findFirst({
                where: { companyNameLower, organizationId: req.user!.organizationId, NOT: { id: req.params.id } }
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: `A supplier named "${existing.companyName}" already exists`,
                    canonical: { id: existing.id, name: existing.companyName }
                });
            }

            updateData.companyName = normalized;
            updateData.companyNameLower = companyNameLower;
        }
        if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (city !== undefined) updateData.city = city;
        if (pincode !== undefined) updateData.pincode = pincode;
        if (website !== undefined) updateData.website = website;

        const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: updateData });
        res.json({ success: true, data: supplier });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:id', checkPermission(PERMISSIONS.MANAGE_SUPPLIERS), async (req: AuthRequest, res: Response) => {
    try {
        const assetCount = await prisma.asset.count({ where: { supplierId: req.params.id } });
        if (assetCount > 0) return res.status(400).json({ success: false, error: `Cannot delete: ${assetCount} assets linked` });
        await prisma.supplier.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
