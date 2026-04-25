import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Dashboard stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const [totalAssets, totalValue, underMaintenance, lowStock, fullyDepreciated, activeAssets] = await Promise.all([
            prisma.asset.count({ where: { organizationId: orgId } }),
            prisma.asset.aggregate({ where: { organizationId: orgId }, _sum: { currentValue: true } }),
            prisma.asset.count({ where: { organizationId: orgId, status: 'UNDER_MAINTENANCE' } }),
            prisma.asset.count({ where: { organizationId: orgId, quantity: { lte: 5 }, status: { not: 'INACTIVE' } } }),
            prisma.asset.count({ where: { organizationId: orgId, currentValue: { lte: 0 } } }),
            prisma.asset.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
        ]);

        const warrantyExpiring = await prisma.asset.count({
            where: {
                organizationId: orgId,
                warrantyExpiryDate: {
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    gte: new Date()
                }
            }
        });

        res.json({
            success: true,
            data: {
                totalAssets,
                totalValue: totalValue._sum.currentValue || 0,
                underMaintenance,
                warrantyExpiring,
                lowStock,
                fullyDepreciated,
                activeAssets
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Dashboard charts
router.get('/charts', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        // Assets by status
        const assetsByStatus = await prisma.asset.groupBy({
            by: ['status'],
            where: { organizationId: orgId },
            _count: true
        });

        // Assets by branch
        const assetsByBranch = await prisma.branch.findMany({
            where: { organizationId: orgId },
            include: { _count: { select: { assets: true } } }
        });

        // Assets by type
        const assetsByType = await prisma.assetType.findMany({
            where: { organizationId: orgId },
            include: { _count: { select: { assets: true } } }
        });

        // Assets by brand
        const assetsByBrand = await prisma.brand.findMany({
            where: { organizationId: orgId },
            include: { _count: { select: { assets: true } } }
        });

        // Recent activities
        const recentAssets = await prisma.asset.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, assetCode: true, createdAt: true, status: true }
        });

        const recentMaintenance = await prisma.maintenanceLog.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { asset: { select: { name: true } } }
        });

        const recentImports = await prisma.importJob.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Monthly depreciation (last 12 months)
        const monthlyDep: { month: string; amount: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const total = await prisma.depreciationSchedule.aggregate({
                where: {
                    asset: { organizationId: orgId },
                    year: d.getFullYear(),
                    month: d.getMonth() + 1
                },
                _sum: { depreciationAmount: true }
            });
            monthlyDep.push({
                month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                amount: total._sum.depreciationAmount || 0
            });
        }

        // Asset value over time (computed from depreciation schedules)
        const assetValueOverTime: { month: string; value: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const totalClosing = await prisma.depreciationSchedule.aggregate({
                where: {
                    asset: { organizationId: orgId },
                    year: d.getFullYear(),
                    month: d.getMonth() + 1
                },
                _sum: { closingValue: true }
            });
            assetValueOverTime.push({
                month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                value: totalClosing._sum.closingValue || 0
            });
        }

        res.json({
            success: true,
            data: {
                assetsByStatus: assetsByStatus.map(s => ({ status: s.status, count: s._count })),
                assetsByBranch: assetsByBranch.map(b => ({ name: b.name, count: b._count.assets })),
                assetsByType: assetsByType.map(t => ({ name: t.name, count: t._count.assets })),
                assetsByBrand: assetsByBrand.map(b => ({ name: b.name, count: b._count.assets })),
                monthlyDepreciation: monthlyDep,
                assetValueOverTime,
                recentActivities: {
                    assets: recentAssets,
                    maintenance: recentMaintenance,
                    imports: recentImports
                }
            }
        });
    } catch (error) {
        console.error('Dashboard charts error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
