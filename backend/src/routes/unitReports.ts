import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ── GET / — List unit reports ──────────────────────────────────────────
router.get('/', checkPermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { status, unitId } = req.query;

        const where: any = {
            unit: { organizationId: orgId },
        };
        if (status) where.status = status as string;
        if (unitId) where.unitId = unitId as string;

        const reports = await prisma.unitReport.findMany({
            where,
            include: {
                unit: { select: { id: true, name: true, location: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                approver: { select: { id: true, name: true, email: true } },
                _count: { select: { notifications: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('List reports error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /pending — List pending reports (for approvers) ────────────────
router.get('/pending', checkPermission(PERMISSIONS.APPROVE_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const reports = await prisma.unitReport.findMany({
            where: {
                status: 'sent',
                unit: { organizationId: orgId },
            },
            include: {
                unit: { select: { id: true, name: true, location: true } },
                createdBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { sentAt: 'desc' },
        });

        res.json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── GET /:id — Get report detail with paginated assets ─────────────────
router.get('/:id', checkPermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const report = await prisma.unitReport.findUnique({
            where: { id: req.params.id },
            include: {
                unit: { select: { id: true, name: true, location: true, address: true, city: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                approver: { select: { id: true, name: true, email: true } },
            },
        });
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

        // Get assets for this unit (branch), paginated
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const skip = (page - 1) * limit;

        const [assets, totalAssets] = await Promise.all([
            prisma.asset.findMany({
                where: { branchId: report.unitId },
                include: {
                    assetType: { select: { name: true } },
                    brand: { select: { name: true } },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            prisma.asset.count({ where: { branchId: report.unitId } }),
        ]);

        res.json({
            success: true,
            data: {
                ...report,
                assets,
                pagination: {
                    page,
                    limit,
                    total: totalAssets,
                    totalPages: Math.ceil(totalAssets / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST / — Create a new unit report ──────────────────────────────────
router.post('/', checkPermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const { unitId } = req.body;
        if (!unitId) return res.status(400).json({ success: false, error: 'unitId is required' });

        // Verify the branch belongs to the org
        const unit = await prisma.branch.findFirst({
            where: { id: unitId, organizationId: req.user!.organizationId },
        });
        if (!unit) return res.status(404).json({ success: false, error: 'Unit/branch not found' });

        const report = await prisma.unitReport.create({
            data: {
                unitId,
                createdById: req.user!.id,
                status: 'draft',
            },
            include: {
                unit: { select: { name: true } },
                createdBy: { select: { name: true } },
            },
        });

        res.status(201).json({ success: true, data: report });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id/send — Send report for approval ──────────────────────────
router.put('/:id/send', checkPermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const report = await prisma.unitReport.findUnique({ where: { id: req.params.id } });
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        if (report.status !== 'draft') {
            return res.status(400).json({ success: false, error: `Cannot send from ${report.status} state` });
        }

        const updated = await prisma.unitReport.update({
            where: { id: report.id },
            data: { status: 'sent', sentAt: new Date() },
        });

        // Create notifications for all users with APPROVE_REPORTS permission
        const orgId = req.user!.organizationId;
        const approvers = await prisma.user.findMany({
            where: {
                organizationId: orgId,
                isActive: true,
                role: { in: ['ADMIN', 'MANAGER'] },
            },
            select: { id: true },
        });

        if (approvers.length > 0) {
            await prisma.reportNotification.createMany({
                data: approvers.map(a => ({
                    reportId: report.id,
                    userId: a.id,
                    type: 'REPORT_PENDING',
                })),
            });
        }

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Send report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id/approve — Approve report with digital signature ───────────
router.put('/:id/approve', checkPermission(PERMISSIONS.APPROVE_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const { signatureImage } = req.body;
        if (!signatureImage) {
            return res.status(400).json({ success: false, error: 'Digital signature is required' });
        }

        const report = await prisma.unitReport.findUnique({ where: { id: req.params.id } });
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        if (report.status !== 'sent') {
            return res.status(400).json({ success: false, error: `Cannot approve from ${report.status} state` });
        }

        const updated = await prisma.unitReport.update({
            where: { id: report.id },
            data: {
                status: 'approved',
                approverId: req.user!.id,
                signatureImage,
                approvedAt: new Date(),
            },
        });

        // Notify creator
        await prisma.reportNotification.create({
            data: {
                reportId: report.id,
                userId: report.createdById,
                type: 'REPORT_APPROVED',
            },
        });

        res.json({ success: true, data: updated, message: 'Report approved with digital signature' });
    } catch (error) {
        console.error('Approve report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /:id/reject — Reject report ───────────────────────────────────
router.put('/:id/reject', checkPermission(PERMISSIONS.APPROVE_REPORTS), async (req: AuthRequest, res: Response) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, error: 'Rejection reason is required' });
        }

        const report = await prisma.unitReport.findUnique({ where: { id: req.params.id } });
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        if (report.status !== 'sent') {
            return res.status(400).json({ success: false, error: `Cannot reject from ${report.status} state` });
        }

        const updated = await prisma.unitReport.update({
            where: { id: report.id },
            data: {
                status: 'rejected',
                approverId: req.user!.id,
                rejectionReason: reason,
                rejectedAt: new Date(),
            },
        });

        // Notify creator
        await prisma.reportNotification.create({
            data: {
                reportId: report.id,
                userId: report.createdById,
                type: 'REPORT_REJECTED',
            },
        });

        res.json({ success: true, data: updated, message: 'Report rejected' });
    } catch (error) {
        console.error('Reject report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /notifications — Get user's notifications ──────────────────────
router.get('/notifications/list', async (req: AuthRequest, res: Response) => {
    try {
        const notifications = await prisma.reportNotification.findMany({
            where: { userId: req.user!.id },
            include: {
                report: {
                    include: {
                        unit: { select: { name: true } },
                        createdBy: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        const unreadCount = await prisma.reportNotification.count({
            where: { userId: req.user!.id, isRead: false },
        });

        res.json({ success: true, data: { notifications, unreadCount } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /notifications/:id/read — Mark notification as read ────────────
router.put('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        await prisma.reportNotification.update({
            where: { id: req.params.id },
            data: { isRead: true },
        });
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PUT /notifications/read-all — Mark all as read ─────────────────────
router.put('/notifications/read-all', async (req: AuthRequest, res: Response) => {
    try {
        await prisma.reportNotification.updateMany({
            where: { userId: req.user!.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true, message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
