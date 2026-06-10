import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.governmentExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No government asset data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.governmentExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, custodianDept: b.custodianDept, gfrClassification: b.gfrClassification, tenderRefNumber: b.tenderRefNumber, gemPortalId: b.gemPortalId, procurementMode: b.procurementMode, disposalMethod: b.disposalMethod, auctionDate: b.auctionDate ? new Date(b.auctionDate) : null, auctionReservePrice: b.auctionReservePrice, interDeptTransferTo: b.interDeptTransferTo, transferDate: b.transferDate ? new Date(b.transferDate) : null, publicRegister: b.publicRegister || false, utilizationScore: b.utilizationScore },
            update: { custodianDept: b.custodianDept, gfrClassification: b.gfrClassification, tenderRefNumber: b.tenderRefNumber, gemPortalId: b.gemPortalId, procurementMode: b.procurementMode, disposalMethod: b.disposalMethod, auctionDate: b.auctionDate ? new Date(b.auctionDate) : undefined, auctionReservePrice: b.auctionReservePrice, interDeptTransferTo: b.interDeptTransferTo, transferDate: b.transferDate ? new Date(b.transferDate) : undefined, publicRegister: b.publicRegister, utilizationScore: b.utilizationScore },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.governmentExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Government extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/public/register', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.governmentExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId }, publicRegister: true },
            include: { asset: { select: { id: true, name: true, assetCode: true, purchasePrice: true, currentValue: true } } },
        });
        res.json({ success: true, data: { total: extensions.length, register: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
