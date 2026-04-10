import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ── POST /generate/:assetId — Generate QR (DRAFT state) ────────────────
router.post('/generate/:assetId', async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const orgId = req.user!.organizationId;

        // Verify asset belongs to org
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, organizationId: orgId },
        });
        if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

        // Check if QR already exists
        const existing = await prisma.qRCode.findUnique({ where: { assetId } });
        if (existing) {
            return res.status(400).json({ success: false, error: 'QR already exists for this asset', data: existing });
        }

        // Generate QR data payload
        const qrData = JSON.stringify({
            assetCode: asset.assetCode,
            assetId: asset.id,
            name: asset.name,
            serialNumber: asset.serialNumber,
            organization: orgId,
            generatedAt: new Date().toISOString(),
        });

        const qr = await prisma.qRCode.create({
            data: {
                assetId,
                qrData,
                status: 'DRAFT',
            },
        });

        // Log action
        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'GENERATED', userId: req.user!.id },
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

        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'SUBMITTED', userId: req.user!.id },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /approve/:qrId — Approve QR (ADMIN/MANAGER) ────────────────────
router.put('/approve/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        const qr = await prisma.qRCode.findUnique({ where: { id: req.params.qrId } });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (qr.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, error: `Cannot approve from ${qr.status} state` });
        }

        const updated = await prisma.qRCode.update({
            where: { id: qr.id },
            data: { status: 'APPROVED', approvedAt: new Date() },
        });

        // Update asset qrCode field with QR data
        await prisma.asset.update({
            where: { id: qr.assetId },
            data: { qrCode: qr.qrData },
        });

        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'APPROVED', userId: req.user!.id },
        });

        res.json({ success: true, data: updated, message: 'QR approved' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /reject/:qrId — Reject QR (ADMIN/MANAGER) ──────────────────────
router.put('/reject/:qrId', async (req: AuthRequest, res: Response) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        const qr = await prisma.qRCode.findUnique({ where: { id: req.params.qrId } });
        if (!qr) return res.status(404).json({ success: false, error: 'QR not found' });
        if (qr.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, error: `Cannot reject from ${qr.status} state` });
        }

        const { reason } = req.body;
        const updated = await prisma.qRCode.update({
            where: { id: qr.id },
            data: { status: 'REJECTED' },
        });

        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'REJECTED', userId: req.user!.id, reason: reason || 'No reason provided' },
        });

        res.json({ success: true, data: updated, message: 'QR rejected' });
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

        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'PRINTED', userId: req.user!.id },
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

        await prisma.qRApprovalLog.create({
            data: { qrCodeId: qr.id, action: 'APPLIED', userId: req.user!.id },
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

// ── GET /pending — List all pending approvals ───────────────────────────
router.get('/pending', async (req: AuthRequest, res: Response) => {
    try {
        const qrs = await prisma.qRCode.findMany({
            where: {
                status: 'PENDING_APPROVAL',
                asset: { organizationId: req.user!.organizationId },
            },
            include: {
                asset: { select: { name: true, assetCode: true, serialNumber: true } },
                approvalLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    include: { user: { select: { name: true } } },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json({ success: true, data: qrs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /asset/:assetId — Get QR status for an asset ────────────────────
router.get('/asset/:assetId', async (req: AuthRequest, res: Response) => {
    try {
        const qr = await prisma.qRCode.findUnique({
            where: { assetId: req.params.assetId },
            include: {
                approvalLogs: {
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { name: true } } },
                },
            },
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

        // Also get assets without QR
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
