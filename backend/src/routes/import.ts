import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import ExcelJS from 'exceljs';
import Fuse from 'fuse.js';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.csv', '.xls'].includes(ext)) cb(null, true);
        else cb(new Error('Only .xlsx, .csv files are allowed'));
    }
});

// Column mapping configuration
const columnMappings = [
    { field: 'assetName', aliases: ['Asset Name', 'asset_name', 'Item Name', 'AssetName', 'Name', 'Asset'] },
    { field: 'brand', aliases: ['Brand', 'Brand Name', 'Manufacturer', 'Make'] },
    { field: 'supplier', aliases: ['Supplier', 'Supplier Name', 'Vendor', 'Vendor Name'] },
    { field: 'supplierEmail', aliases: ['Supplier Email', 'Vendor Email', 'Contact Email', 'Email'] },
    { field: 'supplierPhone', aliases: ['Supplier Phone', 'Phone', 'Contact Number', 'Vendor Phone'] },
    { field: 'supplierAddress', aliases: ['Supplier Address', 'Vendor Address', 'Address'] },
    { field: 'supplierCity', aliases: ['City', 'Supplier City', 'Location City'] },
    { field: 'supplierPincode', aliases: ['Pincode', 'Pin Code', 'Zip Code', 'Postal Code'] },
    { field: 'branch', aliases: ['Branch', 'Sub Location', 'Location', 'Department'] },
    { field: 'purchaseDate', aliases: ['Purchase Date', 'Buy Date', 'Acquisition Date'] },
    { field: 'purchasePrice', aliases: ['Purchase Price', 'Cost', 'Amount', 'Value', 'Price'] },
    { field: 'serialNumber', aliases: ['Serial Number', 'Serial No', 'S/N', 'Serial'] },
    { field: 'quantity', aliases: ['Quantity', 'Qty', 'Count', 'Units'] },
    { field: 'assetType', aliases: ['Asset Type', 'Category', 'Type', 'Classification'] },
    { field: 'description', aliases: ['Description', 'Details', 'Remarks', 'Notes'] },
    { field: 'warrantyExpiry', aliases: ['Warranty', 'Warranty Expiry', 'Warranty Date', 'Warranty End'] },
    { field: 'status', aliases: ['Status', 'Condition', 'State'] },
    { field: 'assignedTo', aliases: ['Assigned To', 'User', 'Employee', 'Owner'] },
    { field: 'companyPolicy', aliases: ['Company Policy', 'Policy', 'Policy Notes'] },
    { field: 'usefulLife', aliases: ['Useful Life', 'Life Years', 'Asset Life'] },
    { field: 'salvageValue', aliases: ['Salvage Value', 'Residual Value', 'Salvage %'] },
    { field: 'depreciationMethod', aliases: ['Depreciation Method', 'Dep Method'] },
];

// Fuzzy match column headers
function mapColumns(headers: string[]): Record<string, string> {
    const allAliases = columnMappings.flatMap(m => m.aliases.map(a => ({ field: m.field, alias: a })));
    const fuse = new Fuse(allAliases, { keys: ['alias'], threshold: 0.3 });
    const mapping: Record<string, string> = {};

    headers.forEach(header => {
        const result = fuse.search(header.trim());
        if (result.length > 0) {
            mapping[header] = result[0].item.field;
        }
    });

    return mapping;
}

// Upload and import Excel
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const orgId = req.user!.organizationId;
        const userId = req.user!.id;

        // Create import job
        const importJob = await prisma.importJob.create({
            data: {
                fileName: req.file.originalname,
                status: 'PROCESSING',
                importedBy: userId,
                organizationId: orgId
            }
        });

        // Parse Excel
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];

        if (!worksheet || worksheet.rowCount < 2) {
            await prisma.importJob.update({ where: { id: importJob.id }, data: { status: 'FAILED', errorLog: JSON.stringify([{ row: 0, error: 'Empty file or no data rows' }]) } });
            return res.status(400).json({ success: false, error: 'File has no data' });
        }

        // Get headers and map columns
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNum) => {
            headers[colNum - 1] = String(cell.value || '').trim();
        });

        const columnMap = mapColumns(headers);
        const getFieldIndex = (field: string): number => {
            const idx = headers.findIndex(h => columnMap[h] === field);
            return idx;
        };

        const totalRows = worksheet.rowCount - 1;
        await prisma.importJob.update({ where: { id: importJob.id }, data: { totalRows } });

        let processedRows = 0;
        let errorRows = 0;
        let skippedRows = 0;
        const errors: any[] = [];
        let brandsCreated = 0, suppliersCreated = 0, branchesCreated = 0, assetsCreated = 0, typesCreated = 0;

        // Process each row
        for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const getCellValue = (field: string): string => {
                const idx = getFieldIndex(field);
                if (idx === -1) return '';
                const cell = row.getCell(idx + 1);
                return String(cell.value || '').trim();
            };

            try {
                const assetName = getCellValue('assetName');
                if (!assetName) {
                    errors.push({ row: rowNum, error: 'Asset name is required' });
                    errorRows++;
                    continue;
                }

                // Duplicate check by serial number
                const serialNum = getCellValue('serialNumber');
                if (serialNum) {
                    const existing = await prisma.asset.findFirst({
                        where: { serialNumber: serialNum, organizationId: orgId }
                    });
                    if (existing) {
                        skippedRows++;
                        continue;
                    }
                }

                // FindOrCreate Brand
                let brandId: string | null = null;
                const brandName = getCellValue('brand');
                if (brandName) {
                    let brand = await prisma.brand.findFirst({ where: { name: brandName, organizationId: orgId } });
                    if (!brand) {
                        brand = await prisma.brand.create({ data: { name: brandName, organizationId: orgId } });
                        brandsCreated++;
                    }
                    brandId = brand.id;
                }

                // FindOrCreate Supplier
                let supplierId: string | null = null;
                const supplierName = getCellValue('supplier');
                if (supplierName) {
                    let supplier = await prisma.supplier.findFirst({
                        where: { OR: [{ companyName: supplierName, organizationId: orgId }, ...(getCellValue('supplierEmail') ? [{ email: getCellValue('supplierEmail'), organizationId: orgId }] : [])] }
                    });
                    if (!supplier) {
                        supplier = await prisma.supplier.create({
                            data: {
                                companyName: supplierName,
                                email: getCellValue('supplierEmail') || null,
                                phone: getCellValue('supplierPhone') || null,
                                address: getCellValue('supplierAddress') || null,
                                city: getCellValue('supplierCity') || null,
                                pincode: getCellValue('supplierPincode') || null,
                                organizationId: orgId
                            }
                        });
                        suppliersCreated++;
                    }
                    supplierId = supplier.id;
                }

                // FindOrCreate Branch
                let branchId: string | null = null;
                const branchName = getCellValue('branch');
                if (branchName) {
                    let branch = await prisma.branch.findFirst({ where: { name: branchName, organizationId: orgId } });
                    if (!branch) {
                        branch = await prisma.branch.create({ data: { name: branchName, organizationId: orgId } });
                        branchesCreated++;
                    }
                    branchId = branch.id;
                }

                // FindOrCreate AssetType
                let assetTypeId: string | null = null;
                const typeName = getCellValue('assetType');
                if (typeName) {
                    let atype = await prisma.assetType.findFirst({ where: { name: typeName, organizationId: orgId } });
                    if (!atype) {
                        const depMethod = getCellValue('depreciationMethod') || 'STRAIGHT_LINE';
                        const usefulLife = parseInt(getCellValue('usefulLife')) || 5;
                        const salvagePercent = parseFloat(getCellValue('salvageValue')) || 10;
                        atype = await prisma.assetType.create({
                            data: { name: typeName, depreciationMethod: depMethod, usefulLifeYears: usefulLife, salvageValuePercent: salvagePercent, organizationId: orgId }
                        });
                        typesCreated++;
                    }
                    assetTypeId = atype.id;
                }

                // Create Asset
                const count = await prisma.asset.count({ where: { organizationId: orgId } });
                const assetCode = `AST-${String(count + 1).padStart(5, '0')}`;
                const purchasePrice = parseFloat(getCellValue('purchasePrice')) || 0;

                const asset = await prisma.asset.create({
                    data: {
                        assetCode,
                        name: assetName,
                        description: getCellValue('description') || null,
                        serialNumber: getCellValue('serialNumber') || null,
                        status: getCellValue('status') || 'ACTIVE',
                        purchaseDate: getCellValue('purchaseDate') ? new Date(getCellValue('purchaseDate')) : null,
                        purchasePrice,
                        currentValue: purchasePrice,
                        warrantyExpiryDate: getCellValue('warrantyExpiry') ? new Date(getCellValue('warrantyExpiry')) : null,
                        branchId,
                        brandId,
                        supplierId,
                        assetTypeId,
                        organizationId: orgId,
                        companyPolicyNotes: getCellValue('companyPolicy') || null,
                        quantity: parseInt(getCellValue('quantity')) || 1,
                    }
                });

                // Create inventory record
                if (branchId) {
                    await prisma.inventoryRecord.create({
                        data: {
                            assetId: asset.id,
                            branchId,
                            quantity: parseInt(getCellValue('quantity')) || 1,
                            minStockLevel: 1,
                            maxStockLevel: 100
                        }
                    });
                }

                // Auto-generate depreciation schedule for newly imported asset
                if (purchasePrice > 0 && assetTypeId) {
                    try {
                        const atype = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
                        if (atype) {
                            const salvageValue = purchasePrice * (atype.salvageValuePercent / 100);
                            const method = atype.depreciationMethod || 'STRAIGHT_LINE';
                            let depAmount = 0;

                            if (method === 'STRAIGHT_LINE') {
                                depAmount = (purchasePrice - salvageValue) / (atype.usefulLifeYears * 12);
                            } else if (method === 'DECLINING_BALANCE') {
                                const rate = 1 - Math.pow(salvageValue / purchasePrice, 1 / atype.usefulLifeYears);
                                depAmount = (purchasePrice * rate) / 12;
                            } else {
                                depAmount = (purchasePrice - salvageValue) / (atype.usefulLifeYears * 12);
                            }

                            const now = new Date();
                            const closingValue = Math.max(salvageValue, purchasePrice - depAmount);
                            const actualDep = purchasePrice - closingValue;

                            await prisma.depreciationSchedule.create({
                                data: {
                                    assetId: asset.id,
                                    year: now.getFullYear(),
                                    month: now.getMonth() + 1,
                                    openingValue: purchasePrice,
                                    depreciationAmount: actualDep,
                                    closingValue,
                                    cumulativeDepreciation: actualDep,
                                    method,
                                    rate: method === 'DECLINING_BALANCE'
                                        ? (1 - Math.pow(salvageValue / purchasePrice, 1 / atype.usefulLifeYears)) * 100
                                        : (100 / atype.usefulLifeYears)
                                }
                            });

                            await prisma.asset.update({ where: { id: asset.id }, data: { currentValue: closingValue } });
                        }
                    } catch (depError) {
                        console.error(`Depreciation generation failed for asset ${asset.id}:`, depError);
                    }
                }

                assetsCreated++;
                processedRows++;
            } catch (rowError: any) {
                errors.push({ row: rowNum, error: rowError.message });
                errorRows++;
            }
        }

        // Update import job
        await prisma.importJob.update({
            where: { id: importJob.id },
            data: {
                status: errorRows > 0 && assetsCreated === 0 ? 'FAILED' : 'COMPLETED',
                processedRows,
                errorRows,
                errorLog: JSON.stringify(errors),
                completedAt: new Date()
            }
        });

        res.json({
            success: true,
            data: {
                jobId: importJob.id,
                totalRows,
                processedRows,
                errorRows,
                skippedRows,
                assetsCreated,
                brandsCreated,
                suppliersCreated,
                branchesCreated,
                typesCreated,
                errors
            }
        });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: error.message || 'Import failed' });
    }
});

// Import history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const jobs = await prisma.importJob.findMany({
            where: { organizationId: req.user!.organizationId },
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } } }
        });
        res.json({ success: true, data: jobs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Download import errors
router.get('/:jobId/errors', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const job = await prisma.importJob.findUnique({ where: { id: req.params.jobId } });
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

        const errors = JSON.parse(job.errorLog as string);
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Errors');
        ws.columns = [
            { header: 'Row Number', key: 'row', width: 15 },
            { header: 'Error', key: 'error', width: 50 }
        ];
        errors.forEach((e: any) => ws.addRow(e));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=import-errors-${job.id}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Download template
router.get('/download', async (_req, res: Response) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Asset Import Template');

        const headers = [
            'Asset Name*', 'Asset Type', 'Brand', 'Serial Number', 'Branch',
            'Purchase Date', 'Purchase Price*', 'Quantity', 'Status',
            'Supplier', 'Supplier Email', 'Supplier Phone', 'Supplier Address',
            'Supplier City', 'Pincode', 'Description', 'Warranty Expiry',
            'Assigned To', 'Company Policy', 'Useful Life (Years)',
            'Salvage Value %', 'Depreciation Method'
        ];

        ws.addRow(headers);

        // Style header row
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
            const isRequired = headers[colNumber - 1].includes('*');
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isRequired ? 'FFFFFF00' : 'FF90EE90' }
            };
            cell.font = { bold: true };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add sample row
        ws.addRow([
            'Dell Latitude 5520', 'Laptop', 'Dell', 'DL-001234', 'HQ Mumbai',
            '2024-01-15', 85000, 1, 'ACTIVE',
            'Dell India Pvt Ltd', 'sales@dell.in', '9876543210', 'Plot 1, Tech Park',
            'Mumbai', '400001', '14" Business Laptop i7', '2027-01-15',
            'John Doe', 'Standard IT Policy', 5, 10, 'STRAIGHT_LINE'
        ]);

        // Set column widths
        ws.columns.forEach(col => { col.width = 20; });

        // Instructions sheet
        const instrWs = workbook.addWorksheet('Instructions');
        instrWs.addRow(['Asset Import Template Instructions']);
        instrWs.addRow([]);
        instrWs.addRow(['Column', 'Required', 'Description']);
        instrWs.addRow(['Asset Name', 'YES', 'Name of the asset']);
        instrWs.addRow(['Asset Type', 'No', 'Category/type (e.g., Laptop, Desktop)']);
        instrWs.addRow(['Brand', 'No', 'Brand/manufacturer name']);
        instrWs.addRow(['Purchase Price', 'YES', 'Purchase cost (positive number)']);
        instrWs.addRow(['Purchase Date', 'No', 'Date format: YYYY-MM-DD']);
        instrWs.addRow(['Status', 'No', 'ACTIVE, INACTIVE, UNDER_MAINTENANCE, DISPOSED, LOST']);
        instrWs.addRow(['Depreciation Method', 'No', 'STRAIGHT_LINE, DECLINING_BALANCE, UNITS_OF_PRODUCTION']);
        instrWs.getColumn(1).width = 25;
        instrWs.getColumn(2).width = 10;
        instrWs.getColumn(3).width = 50;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=asset-import-template.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Column mapping preview
router.post('/preview', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const ws = workbook.worksheets[0];

        const headers: string[] = [];
        ws.getRow(1).eachCell((cell, colNum) => {
            headers[colNum - 1] = String(cell.value || '').trim();
        });

        const columnMap = mapColumns(headers);

        // Get first 5 rows preview
        const previewRows: any[] = [];
        for (let i = 2; i <= Math.min(6, ws.rowCount); i++) {
            const row = ws.getRow(i);
            const rowData: Record<string, any> = {};
            headers.forEach((h, idx) => {
                rowData[h] = String(row.getCell(idx + 1).value || '');
            });
            previewRows.push(rowData);
        }

        res.json({
            success: true,
            data: {
                headers,
                columnMap,
                previewRows,
                totalRows: ws.rowCount - 1,
                availableFields: columnMappings.map(m => ({ field: m.field, label: m.aliases[0] }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Preview failed' });
    }
});

export default router;
