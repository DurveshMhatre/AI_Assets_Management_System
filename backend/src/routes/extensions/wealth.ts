import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.wealthExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No wealth data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.wealthExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, clientName: b.clientName, clientRiskAppetite: b.clientRiskAppetite, investmentHorizon: b.investmentHorizon, targetAllocation: b.targetAllocation ? JSON.stringify(b.targetAllocation) : '{}', actualAllocation: b.actualAllocation ? JSON.stringify(b.actualAllocation) : '{}', taxBracket: b.taxBracket, capitalGainsTax: b.capitalGainsTax || 0, rentalIncomeTax: b.rentalIncomeTax || 0, depreciationBenefit: b.depreciationBenefit || 0, successionNotes: b.successionNotes, documentVaultUrl: b.documentVaultUrl, financialGoal: b.financialGoal, goalTargetAmount: b.goalTargetAmount },
            update: { clientName: b.clientName, clientRiskAppetite: b.clientRiskAppetite, investmentHorizon: b.investmentHorizon, targetAllocation: b.targetAllocation ? JSON.stringify(b.targetAllocation) : undefined, actualAllocation: b.actualAllocation ? JSON.stringify(b.actualAllocation) : undefined, taxBracket: b.taxBracket, capitalGainsTax: b.capitalGainsTax, rentalIncomeTax: b.rentalIncomeTax, depreciationBenefit: b.depreciationBenefit, successionNotes: b.successionNotes, documentVaultUrl: b.documentVaultUrl, financialGoal: b.financialGoal, goalTargetAmount: b.goalTargetAmount },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.wealthExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Wealth extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/networth/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.wealthExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true, currentValue: true, purchasePrice: true } } },
        });
        const totalNetWorth = extensions.reduce((s, e) => s + e.asset.currentValue, 0);
        const totalCost = extensions.reduce((s, e) => s + e.asset.purchasePrice, 0);
        const summary = {
            total: extensions.length, totalNetWorth, totalCost,
            totalCapitalGains: extensions.reduce((s, e) => s + e.capitalGainsTax, 0),
            totalDepreciationBenefit: extensions.reduce((s, e) => s + e.depreciationBenefit, 0),
            byRiskAppetite: {} as Record<string, number>,
        };
        extensions.forEach(e => { const r = e.clientRiskAppetite || 'UNSET'; summary.byRiskAppetite[r] = (summary.byRiskAppetite[r] || 0) + 1; });
        res.json({ success: true, data: { summary, assets: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
