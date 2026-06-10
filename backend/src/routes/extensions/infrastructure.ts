import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.infrastructureExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No infrastructure data for this asset' });
        if (ext.asset.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.json({ success: true, data: ext });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        const { conditionIndex, inspectionFrequency, lastInspectionDate, nextInspectionDate,
                residualLifeYears, latitude, longitude, complianceStatus, complianceChecklist,
                failureSeverity, trafficVolume, deteriorationModel, riskIndex } = req.body;

        const ext = await prisma.infrastructureExtension.upsert({
            where: { assetId: req.params.assetId },
            create: {
                assetId: req.params.assetId,
                conditionIndex, inspectionFrequency,
                lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null,
                nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : null,
                residualLifeYears, latitude, longitude,
                complianceStatus: complianceStatus || 'COMPLIANT',
                complianceChecklist: complianceChecklist ? JSON.stringify(complianceChecklist) : '[]',
                failureSeverity, trafficVolume, deteriorationModel, riskIndex,
            },
            update: {
                conditionIndex, inspectionFrequency,
                lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : undefined,
                nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : undefined,
                residualLifeYears, latitude, longitude, complianceStatus,
                complianceChecklist: complianceChecklist ? JSON.stringify(complianceChecklist) : undefined,
                failureSeverity, trafficVolume, deteriorationModel, riskIndex,
            },
        });
        res.json({ success: true, data: ext });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({
            where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.infrastructureExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Infrastructure extension removed' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get('/condition/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.infrastructureExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });

        const summary = {
            total: extensions.length,
            avgConditionIndex: extensions.filter(e => e.conditionIndex).reduce((s, e) => s + (e.conditionIndex || 0), 0) / (extensions.filter(e => e.conditionIndex).length || 1),
            overdueInspections: extensions.filter(e => e.nextInspectionDate && new Date(e.nextInspectionDate) < new Date()).length,
            byCompliance: {} as Record<string, number>,
            bySeverity: {} as Record<string, number>,
        };

        extensions.forEach(e => {
            summary.byCompliance[e.complianceStatus] = (summary.byCompliance[e.complianceStatus] || 0) + 1;
            if (e.failureSeverity) summary.bySeverity[e.failureSeverity] = (summary.bySeverity[e.failureSeverity] || 0) + 1;
        });

        res.json({ success: true, data: { summary, assets: extensions } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
