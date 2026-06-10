import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.realEstateExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No real estate data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.realEstateExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, propertyType: b.propertyType, carpetAreaSqft: b.carpetAreaSqft, builtUpAreaSqft: b.builtUpAreaSqft, tenantName: b.tenantName, leaseStart: b.leaseStart ? new Date(b.leaseStart) : null, leaseEnd: b.leaseEnd ? new Date(b.leaseEnd) : null, monthlyRent: b.monthlyRent || 0, rentReceived: b.rentReceived || 0, escalationPercent: b.escalationPercent, stampDutyValue: b.stampDutyValue, marketValueEstimate: b.marketValueEstimate, rentalYield: b.rentalYield, occupancyStatus: b.occupancyStatus || 'VACANT' },
            update: { propertyType: b.propertyType, carpetAreaSqft: b.carpetAreaSqft, builtUpAreaSqft: b.builtUpAreaSqft, tenantName: b.tenantName, leaseStart: b.leaseStart ? new Date(b.leaseStart) : undefined, leaseEnd: b.leaseEnd ? new Date(b.leaseEnd) : undefined, monthlyRent: b.monthlyRent, rentReceived: b.rentReceived, escalationPercent: b.escalationPercent, stampDutyValue: b.stampDutyValue, marketValueEstimate: b.marketValueEstimate, rentalYield: b.rentalYield, occupancyStatus: b.occupancyStatus },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.realEstateExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Real estate extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/tenancy/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.realEstateExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });
        const summary = {
            total: extensions.length,
            occupied: extensions.filter(e => e.occupancyStatus === 'OCCUPIED').length,
            vacant: extensions.filter(e => e.occupancyStatus === 'VACANT').length,
            totalMonthlyRent: extensions.reduce((s, e) => s + e.monthlyRent, 0),
            totalRentReceived: extensions.reduce((s, e) => s + e.rentReceived, 0),
            expiringLeases: extensions.filter(e => e.leaseEnd && new Date(e.leaseEnd) <= new Date(Date.now() + 90 * 86400000)).length,
            byType: {} as Record<string, number>,
        };
        extensions.forEach(e => { const t = e.propertyType || 'OTHER'; summary.byType[t] = (summary.byType[t] || 0) + 1; });
        res.json({ success: true, data: { summary, properties: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
