import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

// GET /api/extensions/investment/:assetId — Get investment extension for an asset
router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.investmentExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No investment data for this asset' });
        if (ext.asset.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.json({ success: true, data: ext });
    } catch (error) {
        console.error('Get investment extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PUT /api/extensions/investment/:assetId — Create or update investment extension
router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        const { assetClass, tickerSymbol, exchange, marketValue, purchaseNAV, currentNAV,
                unitsHeld, realizedGain, unrealizedGain, dividendYTD, couponRate,
                maturityDate, riskScore, volatilityIndex } = req.body;

        const ext = await prisma.investmentExtension.upsert({
            where: { assetId: req.params.assetId },
            create: {
                assetId: req.params.assetId,
                assetClass, tickerSymbol, exchange,
                marketValue: marketValue || 0, purchaseNAV: purchaseNAV || 0,
                currentNAV: currentNAV || 0, unitsHeld: unitsHeld || 0,
                realizedGain: realizedGain || 0, unrealizedGain: unrealizedGain || 0,
                dividendYTD: dividendYTD || 0, couponRate, maturityDate: maturityDate ? new Date(maturityDate) : null,
                riskScore, volatilityIndex,
            },
            update: {
                assetClass, tickerSymbol, exchange,
                marketValue, purchaseNAV, currentNAV, unitsHeld,
                realizedGain, unrealizedGain, dividendYTD, couponRate,
                maturityDate: maturityDate ? new Date(maturityDate) : undefined,
                riskScore, volatilityIndex,
            },
        });
        res.json({ success: true, data: ext });
    } catch (error) {
        console.error('Upsert investment extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// DELETE /api/extensions/investment/:assetId — Remove investment extension
router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        await prisma.investmentExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Investment extension removed' });
    } catch (error) {
        console.error('Delete investment extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /api/extensions/investment/portfolio/summary — Portfolio summary across all investment assets
router.get('/portfolio/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.investmentExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });

        const summary = {
            totalInvestments: extensions.length,
            totalMarketValue: extensions.reduce((s, e) => s + e.marketValue, 0),
            totalUnrealizedGain: extensions.reduce((s, e) => s + e.unrealizedGain, 0),
            totalRealizedGain: extensions.reduce((s, e) => s + e.realizedGain, 0),
            totalDividends: extensions.reduce((s, e) => s + e.dividendYTD, 0),
            byAssetClass: {} as Record<string, { count: number; value: number }>,
        };

        extensions.forEach(e => {
            const cls = e.assetClass || 'UNCLASSIFIED';
            if (!summary.byAssetClass[cls]) summary.byAssetClass[cls] = { count: 0, value: 0 };
            summary.byAssetClass[cls].count++;
            summary.byAssetClass[cls].value += e.marketValue;
        });

        res.json({ success: true, data: { summary, investments: extensions } });
    } catch (error) {
        console.error('Portfolio summary error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
