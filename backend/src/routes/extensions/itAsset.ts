import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.iTAssetExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No IT asset data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.iTAssetExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, subType: b.subType || 'HAM', cpuModel: b.cpuModel, ramGB: b.ramGB, storageGB: b.storageGB, storageType: b.storageType, osVersion: b.osVersion, eolDate: b.eolDate ? new Date(b.eolDate) : null, licenseKey: b.licenseKey, licenseType: b.licenseType, licensedSeats: b.licensedSeats, allocatedSeats: b.allocatedSeats, licenseVendor: b.licenseVendor, licenseExpiry: b.licenseExpiry ? new Date(b.licenseExpiry) : null, costPerSeat: b.costPerSeat, cloudProvider: b.cloudProvider, cloudResourceId: b.cloudResourceId, instanceType: b.instanceType, region: b.region, monthlyCost: b.monthlyCost },
            update: { subType: b.subType, cpuModel: b.cpuModel, ramGB: b.ramGB, storageGB: b.storageGB, storageType: b.storageType, osVersion: b.osVersion, eolDate: b.eolDate ? new Date(b.eolDate) : undefined, licenseKey: b.licenseKey, licenseType: b.licenseType, licensedSeats: b.licensedSeats, allocatedSeats: b.allocatedSeats, licenseVendor: b.licenseVendor, licenseExpiry: b.licenseExpiry ? new Date(b.licenseExpiry) : undefined, costPerSeat: b.costPerSeat, cloudProvider: b.cloudProvider, cloudResourceId: b.cloudResourceId, instanceType: b.instanceType, region: b.region, monthlyCost: b.monthlyCost },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.iTAssetExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'IT asset extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/licenses/compliance', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.iTAssetExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });
        const ham = extensions.filter(e => e.subType === 'HAM');
        const sam = extensions.filter(e => e.subType === 'SAM');
        const cam = extensions.filter(e => e.subType === 'CAM');
        const summary = {
            total: extensions.length, hamCount: ham.length, samCount: sam.length, camCount: cam.length,
            totalLicensedSeats: sam.reduce((s, e) => s + (e.licensedSeats || 0), 0),
            totalAllocatedSeats: sam.reduce((s, e) => s + (e.allocatedSeats || 0), 0),
            totalMonthlyCost: cam.reduce((s, e) => s + (e.monthlyCost || 0), 0),
            expiringLicenses: sam.filter(e => e.licenseExpiry && new Date(e.licenseExpiry) <= new Date(Date.now() + 90 * 86400000)).length,
            eolHardware: ham.filter(e => e.eolDate && new Date(e.eolDate) <= new Date(Date.now() + 180 * 86400000)).length,
        };
        res.json({ success: true, data: { summary, assets: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
