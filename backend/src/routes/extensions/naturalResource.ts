import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.naturalResourceExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No natural resource data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.naturalResourceExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, resourceType: b.resourceType, carbonCredits: b.carbonCredits || 0, registryId: b.registryId, vintageYear: b.vintageYear, creditPricePerTon: b.creditPricePerTon, ecosystemService: b.ecosystemService, ecosystemValuation: b.ecosystemValuation, complianceClearance: b.complianceClearance, clearanceExpiry: b.clearanceExpiry ? new Date(b.clearanceExpiry) : null, degradationIndex: b.degradationIndex, lastFieldSurveyDate: b.lastFieldSurveyDate ? new Date(b.lastFieldSurveyDate) : null, nextAssessmentDate: b.nextAssessmentDate ? new Date(b.nextAssessmentDate) : null, ndviScore: b.ndviScore },
            update: { resourceType: b.resourceType, carbonCredits: b.carbonCredits, registryId: b.registryId, vintageYear: b.vintageYear, creditPricePerTon: b.creditPricePerTon, ecosystemService: b.ecosystemService, ecosystemValuation: b.ecosystemValuation, complianceClearance: b.complianceClearance, clearanceExpiry: b.clearanceExpiry ? new Date(b.clearanceExpiry) : undefined, degradationIndex: b.degradationIndex, lastFieldSurveyDate: b.lastFieldSurveyDate ? new Date(b.lastFieldSurveyDate) : undefined, nextAssessmentDate: b.nextAssessmentDate ? new Date(b.nextAssessmentDate) : undefined, ndviScore: b.ndviScore },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.naturalResourceExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Natural resource extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/carbon/summary', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.naturalResourceExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true } } },
        });
        const summary = {
            total: extensions.length,
            totalCarbonCredits: extensions.reduce((s, e) => s + e.carbonCredits, 0),
            totalEcosystemValue: extensions.reduce((s, e) => s + (e.ecosystemValuation || 0), 0),
            avgDegradation: extensions.filter(e => e.degradationIndex != null).length > 0 ? extensions.reduce((s, e) => s + (e.degradationIndex || 0), 0) / extensions.filter(e => e.degradationIndex != null).length : 0,
            overdueSurveys: extensions.filter(e => e.nextAssessmentDate && new Date(e.nextAssessmentDate) < new Date()).length,
            byResourceType: {} as Record<string, number>,
        };
        extensions.forEach(e => { const t = e.resourceType || 'OTHER'; summary.byResourceType[t] = (summary.byResourceType[t] || 0) + 1; });
        res.json({ success: true, data: { summary, resources: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
