import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { checkPermission } from '../../middleware/permissions';
import { PERMISSIONS } from '../../constants/permissions';

const router = Router();
const prisma = new PrismaClient();

router.get('/:assetId', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const ext = await prisma.digitalAssetExtension.findUnique({
            where: { assetId: req.params.assetId },
            include: { asset: { select: { id: true, name: true, assetCode: true, organizationId: true } } },
        });
        if (!ext) return res.status(404).json({ success: false, error: 'No digital asset data' });
        if (ext.asset.organizationId !== req.user!.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        const b = req.body;
        const ext = await prisma.digitalAssetExtension.upsert({
            where: { assetId: req.params.assetId },
            create: { assetId: req.params.assetId, mediaType: b.mediaType, keywords: b.keywords ? JSON.stringify(b.keywords) : '[]', projectName: b.projectName, campaignName: b.campaignName, usageRights: b.usageRights, rightsExpiry: b.rightsExpiry ? new Date(b.rightsExpiry) : null, versionNumber: b.versionNumber || '1.0', downloadCount: b.downloadCount || 0, fileHash: b.fileHash, collectionName: b.collectionName, lastAccessedAt: b.lastAccessedAt ? new Date(b.lastAccessedAt) : null },
            update: { mediaType: b.mediaType, keywords: b.keywords ? JSON.stringify(b.keywords) : undefined, projectName: b.projectName, campaignName: b.campaignName, usageRights: b.usageRights, rightsExpiry: b.rightsExpiry ? new Date(b.rightsExpiry) : undefined, versionNumber: b.versionNumber, downloadCount: b.downloadCount, fileHash: b.fileHash, collectionName: b.collectionName, lastAccessedAt: b.lastAccessedAt ? new Date(b.lastAccessedAt) : undefined },
        });
        res.json({ success: true, data: ext });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.delete('/:assetId', checkPermission(PERMISSIONS.EDIT_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const asset = await prisma.asset.findFirst({ where: { id: req.params.assetId, organizationId: req.user!.organizationId } });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
        await prisma.digitalAssetExtension.deleteMany({ where: { assetId: req.params.assetId } });
        res.json({ success: true, message: 'Digital asset extension removed' });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/media/library', checkPermission(PERMISSIONS.VIEW_EXTENSIONS), async (req: AuthRequest, res: Response) => {
    try {
        const extensions = await prisma.digitalAssetExtension.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: { asset: { select: { id: true, name: true, assetCode: true, photoUrl: true } } },
        });
        const summary = {
            total: extensions.length,
            totalDownloads: extensions.reduce((s, e) => s + e.downloadCount, 0),
            byMediaType: {} as Record<string, number>,
            expiringRights: extensions.filter(e => e.rightsExpiry && new Date(e.rightsExpiry) <= new Date(Date.now() + 90 * 86400000)).length,
        };
        extensions.forEach(e => {
            const mt = e.mediaType || 'OTHER';
            summary.byMediaType[mt] = (summary.byMediaType[mt] || 0) + 1;
        });
        res.json({ success: true, data: { summary, media: extensions } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

export default router;
