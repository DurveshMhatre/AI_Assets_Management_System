import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// Power BI Export (Clean flat Excel)
router.get('/export/powerbi', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const assets = await prisma.asset.findMany({
            where: { organizationId: orgId },
            include: {
                brand: { select: { name: true } },
                supplier: { select: { companyName: true } },
                branch: { select: { name: true } },
                assetType: { select: { name: true } },
                assignedTo: { select: { name: true } }
            }
        });

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Assets');

        ws.columns = [
            { header: 'Asset Code', key: 'assetCode', width: 15 },
            { header: 'Asset Name', key: 'name', width: 25 },
            { header: 'Brand', key: 'brand', width: 15 },
            { header: 'Supplier', key: 'supplier', width: 20 },
            { header: 'Asset Type', key: 'assetType', width: 15 },
            { header: 'Location', key: 'location', width: 15 },
            { header: 'Branch', key: 'branch', width: 15 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
            { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
            { header: 'Current Value', key: 'currentValue', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Serial Number', key: 'serialNumber', width: 18 },
            { header: 'Assigned To', key: 'assignedTo', width: 15 },
            { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
        ];

        // Style header row
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        assets.forEach(a => {
            ws.addRow({
                assetCode: a.assetCode,
                name: a.name,
                brand: a.brand?.name || 'N/A',
                supplier: a.supplier?.companyName || 'N/A',
                assetType: a.assetType?.name || 'N/A',
                location: a.location || 'N/A',
                branch: a.branch?.name || 'N/A',
                purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toISOString().substring(0, 10) : 'N/A',
                purchasePrice: a.purchasePrice,
                currentValue: a.currentValue,
                status: a.status,
                serialNumber: a.serialNumber || 'N/A',
                assignedTo: a.assignedTo?.name || 'N/A',
                warrantyExpiry: a.warrantyExpiryDate ? new Date(a.warrantyExpiryDate).toISOString().substring(0, 10) : 'N/A',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="PowerBI_Asset_Data.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Power BI export error:', error);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// PDF Export
router.get('/export/pdf', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const assets = await prisma.asset.findMany({
            where: { organizationId: orgId },
            include: {
                brand: { select: { name: true } },
                branch: { select: { name: true } },
                assetType: { select: { name: true } }
            },
            orderBy: { assetCode: 'asc' }
        });

        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Asset_Report.pdf"');
        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Asset Report', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1.5);

        // Summary
        const totalValue = assets.reduce((sum, a) => sum + a.purchasePrice, 0);
        const currentTotal = assets.reduce((sum, a) => sum + a.currentValue, 0);
        doc.fontSize(11).font('Helvetica-Bold').text('Summary');
        doc.fontSize(9).font('Helvetica');
        doc.text(`Total Assets: ${assets.length}`);
        doc.text(`Total Purchase Value: ₹${totalValue.toLocaleString()}`);
        doc.text(`Total Current Value: ₹${currentTotal.toLocaleString()}`);
        doc.moveDown();

        // Table header
        doc.fontSize(9).font('Helvetica-Bold');
        const tableTop = doc.y;
        doc.text('Code', 40, tableTop, { width: 70 });
        doc.text('Name', 110, tableTop, { width: 120 });
        doc.text('Type', 230, tableTop, { width: 70 });
        doc.text('Location', 300, tableTop, { width: 80 });
        doc.text('Status', 380, tableTop, { width: 60 });
        doc.text('Value (₹)', 440, tableTop, { width: 80, align: 'right' });
        doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).stroke();

        // Table rows
        doc.font('Helvetica').fontSize(8);
        let y = tableTop + 20;

        for (const a of assets) {
            if (y > 750) {
                doc.addPage();
                y = 40;
            }
            doc.text(a.assetCode, 40, y, { width: 70 });
            doc.text(a.name.substring(0, 20), 110, y, { width: 120 });
            doc.text(a.assetType?.name || '—', 230, y, { width: 70 });
            doc.text(a.branch?.name || '—', 300, y, { width: 80 });
            doc.text(a.status, 380, y, { width: 60 });
            doc.text(`₹${a.currentValue.toLocaleString()}`, 440, y, { width: 80, align: 'right' });
            y += 16;
        }

        doc.end();
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Get report data
router.get('/:type', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const type = req.params.type;
        const format = req.query.format as string; // 'json' | 'excel'

        let data: any;
        let title = '';

        switch (type) {
            case 'asset-register':
                title = 'Asset Register Report';
                data = await prisma.asset.findMany({
                    where: { organizationId: orgId },
                    include: { branch: true, brand: true, supplier: true, assetType: true, assignedTo: { select: { name: true } } },
                    orderBy: { assetCode: 'asc' }
                });
                break;
            case 'asset-valuation':
                title = 'Asset Valuation Report';
                data = await prisma.asset.findMany({
                    where: { organizationId: orgId },
                    include: { branch: true, assetType: true },
                    orderBy: { currentValue: 'desc' }
                });
                break;
            case 'depreciation-schedule':
                title = 'Depreciation Schedule Report';
                data = await prisma.asset.findMany({
                    where: { organizationId: orgId },
                    include: { assetType: true, depreciationSchedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] } }
                });
                break;
            case 'maintenance-history':
                title = 'Maintenance History Report';
                data = await prisma.maintenanceLog.findMany({
                    where: { organizationId: orgId },
                    include: { asset: true, technician: { select: { name: true } } },
                    orderBy: { scheduledDate: 'desc' }
                });
                break;
            case 'inventory-stock':
                title = 'Inventory Stock Report';
                data = await prisma.inventoryRecord.findMany({
                    where: { asset: { organizationId: orgId } },
                    include: { asset: true, branch: true }
                });
                break;
            case 'asset-by-supplier':
                title = 'Asset by Supplier Report';
                data = await prisma.supplier.findMany({
                    where: { organizationId: orgId },
                    include: { assets: { include: { assetType: true } } }
                });
                break;
            case 'asset-by-brand':
                title = 'Asset by Brand Report';
                data = await prisma.brand.findMany({
                    where: { organizationId: orgId },
                    include: { assets: { include: { assetType: true } } }
                });
                break;
            case 'asset-by-branch':
                title = 'Asset by Location Report';
                data = await prisma.branch.findMany({
                    where: { organizationId: orgId },
                    include: { assets: { include: { assetType: true, brand: true } } }
                });
                break;
            case 'fully-depreciated':
                title = 'Fully Depreciated Assets';
                data = await prisma.asset.findMany({
                    where: { organizationId: orgId, currentValue: { lte: 0 } },
                    include: { assetType: true, branch: true }
                });
                break;
            case 'warranty-expiry':
                title = 'Warranty Expiry Report';
                const days = parseInt(req.query.days as string) || 90;
                data = await prisma.asset.findMany({
                    where: {
                        organizationId: orgId,
                        warrantyExpiryDate: {
                            lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
                            gte: new Date()
                        }
                    },
                    include: { brand: true, branch: true },
                    orderBy: { warrantyExpiryDate: 'asc' }
                });
                break;
            case 'audit-trail':
                title = 'Audit Trail Report';
                data = await prisma.auditLog.findMany({
                    where: { user: { organizationId: orgId } },
                    include: { user: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 500
                });
                break;
            case 'import-history':
                title = 'Import History Report';
                data = await prisma.importJob.findMany({
                    where: { organizationId: orgId },
                    include: { user: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                });
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid report type' });
        }

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet(title);

            if (Array.isArray(data) && data.length > 0) {
                const flatData = data.map((item: any) => {
                    const flat: any = {};
                    Object.entries(item).forEach(([k, v]) => {
                        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
                            Object.entries(v as any).forEach(([k2, v2]) => {
                                if (typeof v2 !== 'object') flat[`${k}_${k2}`] = v2;
                            });
                        } else if (!(v && typeof v === 'object' && Array.isArray(v))) {
                            flat[k] = v;
                        }
                    });
                    return flat;
                });

                const headers = Object.keys(flatData[0]);
                ws.addRow(headers);
                const headerRow = ws.getRow(1);
                headerRow.font = { bold: true };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

                flatData.forEach(row => ws.addRow(Object.values(row)));
                ws.columns.forEach(col => { col.width = 18; });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }

        res.json({ success: true, data, title });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
