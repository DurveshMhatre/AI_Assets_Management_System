import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.fixedAssetExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No fixed asset data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.fixedAssetExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, accountingBlock: b.accountingBlock, financialYear: b.financialYear, wdvOpeningBalance: b.wdvOpeningBalance || 0, additionsThisYear: b.additionsThisYear || 0, disposalsThisYear: b.disposalsThisYear || 0, wdvClosingBalance: b.wdvClosingBalance || 0, impairmentFlag: b.impairmentFlag || false, impairmentAmount: b.impairmentAmount || 0, revaluationReserve: b.revaluationReserve || 0, recoverableAmount: b.recoverableAmount, auditFormRef: b.auditFormRef },
            update: { accountingBlock: b.accountingBlock, financialYear: b.financialYear, wdvOpeningBalance: b.wdvOpeningBalance, additionsThisYear: b.additionsThisYear, disposalsThisYear: b.disposalsThisYear, wdvClosingBalance: b.wdvClosingBalance, impairmentFlag: b.impairmentFlag, impairmentAmount: b.impairmentAmount, revaluationReserve: b.revaluationReserve, recoverableAmount: b.recoverableAmount, auditFormRef: b.auditFormRef },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.fixedAssetExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Fixed asset extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/accounting/register', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.fixedAssetExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true, purchasePrice: true, currentValue: true } } },
        });
        const summary = {
            total: extensions.length,
            totalWDVOpening: extensions.reduce((s, e) => s + e.wdvOpeningBalance, 0),
            totalAdditions: extensions.reduce((s, e) => s + e.additionsThisYear, 0),
            totalDisposals: extensions.reduce((s, e) => s + e.disposalsThisYear, 0),
            impaired: extensions.filter(e => e.impairmentFlag).length,
        };
        res.json({ success: true, data: { summary, register: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
