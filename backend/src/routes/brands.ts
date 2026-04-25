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
        const brands = await prisma.brand.findMany({
            where: { organizationId: req.user!.organizationId },
            include: { _count: { select: { assets: true, assetTypes: true } } },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, data: brands });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// Check duplicate brand name (case-insensitive)
router.get('/check-duplicate', async (req: AuthRequest, res: Response) => {
    try {
        const name = req.query.name as string;
        const excludeId = req.query.excludeId as string;
        if (!name) return res.json({ exists: false });

        const nameLower = name.toLowerCase().trim();
        const where: any = {
            nameLower,
            organizationId: req.user!.organizationId,
        };
        if (excludeId) where.NOT = { id: excludeId };

        const existing = await prisma.brand.findFirst({ where });
        if (existing) {
            res.json({ exists: true, canonical: { id: existing.id, name: existing.name } });
        } else {
            res.json({ exists: false });
        }
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const brand = await prisma.brand.findUnique({
            where: { id: req.params.id },
            include: { assets: { include: { assetType: true } }, _count: { select: { assets: true } } }
        });
        if (!brand) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: brand });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.post('/', checkPermission(PERMISSIONS.MANAGE_BRANDS), async (req: AuthRequest, res: Response) => {
    try {
        const { name, logo, website, description } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Name is required' });

        const normalized = toTitleCase(name);
        const nameLower = normalized.toLowerCase();

        // Check for duplicates
        const existing = await prisma.brand.findFirst({
            where: { nameLower, organizationId: req.user!.organizationId }
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: `A brand named "${existing.name}" already exists`,
                canonical: { id: existing.id, name: existing.name }
            });
        }

        const brand = await prisma.brand.create({
            data: { name: normalized, nameLower, logo, website, description, organizationId: req.user!.organizationId }
        });
        res.status(201).json({ success: true, data: brand });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:id', checkPermission(PERMISSIONS.MANAGE_BRANDS), async (req: AuthRequest, res: Response) => {
    try {
        const { name, logo, website, description } = req.body;
        const updateData: any = {};

        if (name !== undefined) {
            const normalized = toTitleCase(name);
            const nameLower = normalized.toLowerCase();

            // Check for duplicates (excluding self)
            const existing = await prisma.brand.findFirst({
                where: { nameLower, organizationId: req.user!.organizationId, NOT: { id: req.params.id } }
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: `A brand named "${existing.name}" already exists`,
                    canonical: { id: existing.id, name: existing.name }
                });
            }

            updateData.name = normalized;
            updateData.nameLower = nameLower;
        }
        if (logo !== undefined) updateData.logo = logo;
        if (website !== undefined) updateData.website = website;
        if (description !== undefined) updateData.description = description;

        const brand = await prisma.brand.update({ where: { id: req.params.id }, data: updateData });
        res.json({ success: true, data: brand });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:id', checkPermission(PERMISSIONS.MANAGE_BRANDS), async (req: AuthRequest, res: Response) => {
    try {
        const assetCount = await prisma.asset.count({ where: { brandId: req.params.id } });
        if (assetCount > 0) return res.status(400).json({ success: false, error: `Cannot delete: ${assetCount} assets linked` });
        await prisma.brand.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
