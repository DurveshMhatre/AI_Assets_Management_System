import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ── POST /generate/:assetId — Generate QR (DRAFT state) ────────────────
router.post('/generate/:assetId', checkPermission(PERMISSIONS.MANAGE_QR), async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const orgId = req.user!.organizationId;

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, organizationId: orgId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        const existing = await prisma.qRCode.findUnique({ where: { assetId } });
        if (existing) {
            return res.status(400).json({ success: false, error: 'QR already exists for this asset', data: existing });
        }

        const qrData = JSON.stringify({
            assetCode: asset.assetCode,
            assetId: asset.id,
            name: asset.name,
            serialNumber: asset.serialNumber,
            organization: orgId,
            generatedAt: new Date().toISOString(),
        });

        const qr = await prisma.qRCode.create({
            data: { assetId, qrData, status: 'DRAFT' },
        });

        res.status(201).json({ success: true, data: qr });
    } catch (error) {
        console.error('QR generate error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST /submit/:qrId — Submit for approval ───────────────────────────
router.post('/submit/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({ where: { id: req.params.qrId } });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (qr.status !== 'DRAFT') {
            return res.status(400).json({ success: false, error: `Cannot submit from ${qr.status} state` });
        }

        const updated = await prisma.qRCode.update({
            where: { id: qr.id },
            data: { status: 'PENDING_APPROVAL', submittedAt: new Date() },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /mark-printed/:qrId — Mark as printed ──────────────────────────
router.put('/mark-printed/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({ where: { id: req.params.qrId } });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (qr.status !== 'APPROVED') {
            return res.status(400).json({ success: false, error: `Cannot mark printed from ${qr.status} state` });
        }

        const updated = await prisma.qRCode.update({
            where: { id: qr.id },
            data: { status: 'PRINTED', printedAt: new Date() },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /mark-applied/:qrId — Mark physically applied ──────────────────
router.put('/mark-applied/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({ where: { id: req.params.qrId } });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (qr.status !== 'PRINTED') {
            return res.status(400).json({ success: false, error: `Cannot mark applied from ${qr.status} state` });
        }

        const updated = await prisma.qRCode.update({
            where: { id: qr.id },
            data: { status: 'APPLIED', appliedAt: new Date() },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /download/:qrId — Get QR data for download ─────────────────────
router.get('/download/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({
            where: { id: req.params.qrId },
            include: { asset: { select: { name: true, assetCode: true } } },
        });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (!['APPROVED', 'PRINTED', 'APPLIED'].includes(qr.status)) {
            return res.status(400).json({ success: false, error: 'QR not yet approved' });
        }

        res.json({
            success: true,
            data: {
                qrData: qr.qrData,
                assetName: qr.asset.name,
                assetCode: qr.asset.assetCode,
                status: qr.status,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /asset/:assetId — Get QR status for an asset ────────────────────
router.get('/asset/:assetId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({
            where: { assetId: req.params.assetId },
        });
        res.json({ success: true, data: qr });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /all — List all QRs for org (kanban tracker) ────────────────────
router.get('/all', async (req: AuthRequest, res: Response) => {
    try {
        const qrs = await prisma.qRCode.findMany({
            where: { asset: { organizationId: req.user!.organizationId } },
            include: {
                asset: { select: { id: true, name: true, assetCode: true, serialNumber: true, status: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        const assetsWithoutQR = await prisma.asset.findMany({
            where: {
                organizationId: req.user!.organizationId,
                qrCode: null,
                NOT: { id: { in: qrs.map(q => q.assetId) } },
            },
            select: { id: true, name: true, assetCode: true, serialNumber: true, status: true },
        });

        res.json({ success: true, data: { qrs, assetsWithoutQR } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
