import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

// GET /:assetId
router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.physicalAssetExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No physical asset data for this asset' });
        if (ext.asset.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.json({ success: true, data: ext });
    } catch (error) {
        console.error('Get physical asset extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PUT /:assetId — upsert
router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        const { lifecycleStage, mtbfHours, mttrHours, oeeScore, totalOperatingHours,
                lastFailureDate, failureMode, failureCount, warrantyClaimStatus,
                warrantyClaimRef, spareParts, conditionScore, nextPMDate } = req.body;

        const ext = await prisma.physicalAssetExtension.upsert({
            where: { assetId: req.params.assetId },
            create: {
                assetId: req.params.assetId,
                lifecycleStage: lifecycleStage || 'ACTIVE', mtbfHours, mttrHours, oeeScore,
                totalOperatingHours: totalOperatingHours || 0,
                lastFailureDate: lastFailureDate ? new Date(lastFailureDate) : null,
                failureMode, failureCount: failureCount || 0,
                warrantyClaimStatus, warrantyClaimRef,
                spareParts: spareParts ? JSON.stringify(spareParts) : '[]',
                conditionScore, nextPMDate: nextPMDate ? new Date(nextPMDate) : null,
            },
            update: {
                lifecycleStage, mtbfHours, mttrHours, oeeScore, totalOperatingHours,
                lastFailureDate: lastFailureDate ? new Date(lastFailureDate) : undefined,
                failureMode, failureCount, warrantyClaimStatus, warrantyClaimRef,
                spareParts: spareParts ? JSON.stringify(spareParts) : undefined,
                conditionScore, nextPMDate: nextPMDate ? new Date(nextPMDate) : undefined,
            },
        });
        res.json({ success: true, data: ext });
    } catch (error) {
        console.error('Upsert physical asset extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// DELETE /:assetId
router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.physicalAssetExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Physical asset extension removed' });
    } catch (error) {
        console.error('Delete physical asset extension error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /lifecycle/summary
router.get('/lifecycle/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.physicalAssetExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });

        const summary = {
            total: extensions.length,
            avgOEE: extensions.filter(e => e.oeeScore).reduce((s, e) => s + (e.oeeScore || 0), 0) / (extensions.filter(e => e.oeeScore).length || 1),
            avgConditionScore: extensions.filter(e => e.conditionScore).reduce((s, e) => s + (e.conditionScore || 0), 0) / (extensions.filter(e => e.conditionScore).length || 1),
            byStage: {} as Record<string, number>,
            upcomingPM: extensions.filter(e => e.nextPMDate && new Date(e.nextPMDate) <= new Date(Date.now() + 30 * 86400000)).length,
        };

        extensions.forEach(e => {
            const stage = e.lifecycleStage || 'UNKNOWN';
            summary.byStage[stage] = (summary.byStage[stage] || 0) + 1;
        });

        res.json({ success: true, data: { summary, assets: extensions } });
    } catch (error) {
        console.error('Lifecycle summary error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
