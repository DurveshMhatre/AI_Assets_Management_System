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

// ─── FIELD CONFIGURATION ────────────────────────────────────────────────────────

interface FieldConfig {
    keywords: string[];
    priority: number;   // 1 (highest) to 5 (lowest)
    required: boolean;
    narrowVision: boolean;
    dataType?: 'currency' | 'date' | 'number';
}

const FIELD_DICTIONARY: Record<string, FieldConfig> = {
    assetName:    { keywords: ['asset name', 'name', 'asset', 'item name', 'item', 'title', 'description'], priority: 1, required: true, narrowVision: true },
    serialNumber: { keywords: ['serial number', 'serial no', 'serial', 's/n', 'sn', 'id', 'identifier', 'code'], priority: 1, required: true, narrowVision: true },
    brand:        { keywords: ['brand', 'brand name', 'manufacturer', 'make', 'vendor', 'company'], priority: 2, required: false, narrowVision: false },
    supplier:     { keywords: ['supplier', 'supplier name', 'vendor', 'vendor name', 'seller', 'provider', 'source'], priority: 2, required: false, narrowVision: false },
    supplierEmail:{ keywords: ['supplier email', 'vendor email', 'email', 'contact email'], priority: 3, required: false, narrowVision: false },
    supplierPhone:{ keywords: ['supplier phone', 'phone', 'contact number', 'mobile', 'vendor phone'], priority: 3, required: false, narrowVision: false },
    supplierAddress:{ keywords: ['supplier address', 'vendor address', 'address'], priority: 4, required: false, narrowVision: false },
    city:         { keywords: ['city', 'supplier city', 'location city'], priority: 4, required: false, narrowVision: false },
    pincode:      { keywords: ['pincode', 'pin code', 'zip', 'zip code', 'postal code'], priority: 4, required: false, narrowVision: false },
    branch:       { keywords: ['branch', 'location', 'sub location', 'department', 'site', 'office', 'place'], priority: 3, required: false, narrowVision: false },
    assetType:    { keywords: ['asset type', 'type', 'category', 'classification', 'class', 'group'], priority: 2, required: false, narrowVision: false },
    purchaseDate: { keywords: ['purchase date', 'buy date', 'acquisition date', 'date of purchase', 'date', 'acquired', 'bought'], priority: 1, required: true, narrowVision: true, dataType: 'date' },
    purchasePrice:{ keywords: ['purchase price', 'cost', 'price', 'amount', 'value', 'cost price', 'purchase'], priority: 1, required: true, narrowVision: true, dataType: 'currency' },
    quantity:     { keywords: ['quantity', 'qty', 'count', 'units', 'stock'], priority: 3, required: false, narrowVision: false, dataType: 'number' },
    description:  { keywords: ['description', 'details', 'remarks', 'notes'], priority: 3, required: false, narrowVision: false },
    status:       { keywords: ['status', 'condition', 'state', 'asset status', 'active'], priority: 3, required: false, narrowVision: false },
    warrantyExpiry:{ keywords: ['warranty expiry', 'warranty', 'warranty date', 'expiry date', 'warranty end'], priority: 3, required: false, narrowVision: false, dataType: 'date' },
    usefulLife:   { keywords: ['useful life', 'life years', 'asset life', 'depreciation years', 'years', 'duration', 'period'], priority: 4, required: false, narrowVision: false, dataType: 'number' },
    salvageValue: { keywords: ['salvage value', 'residual value', 'scrap value', 'salvage', 'residual', 'scrap', 'end'], priority: 4, required: false, narrowVision: false, dataType: 'currency' },
    depMethod:    { keywords: ['depreciation method', 'dep method', 'method'], priority: 4, required: false, narrowVision: false },
    assignedTo:   { keywords: ['assigned to', 'employee', 'owner', 'user', 'in charge'], priority: 3, required: false, narrowVision: false },
    companyPolicy:{ keywords: ['company policy', 'policy', 'policy notes'], priority: 4, required: false, narrowVision: false },
};

const REQUIRED_FIELDS = Object.entries(FIELD_DICTIONARY).filter(([, v]) => v.required).map(([k]) => k);

// ─── HEADER NORMALISATION ───────────────────────────────────────────────────────

function normalizeHeader(header: string): string {
    return String(header || '').toLowerCase().trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
}

// ─── INTELLIGENT MAPPING ENGINE ─────────────────────────────────────────────────

interface MappingSuggestion {
    excelHeader: string;
    confidence: number;  // 0–1
}

interface SmartMappingResult {
    matched: Record<string, MappingSuggestion>;
    unmappedSystemFields: string[];
    unmatchedExcelColumns: string[];
    missingRequired: string[];
    allExcelHeaders: string[];
    averageConfidence: number;
    requiresManualReview: boolean;
}

/**
 * Get org-pattern boost for a given header→field combination.
 * Returns 0–0.15 boost based on org's history.
 */
async function getOrgPatternBoost(orgId: string, normalizedHeader: string, systemField: string): Promise<number> {
    try {
        const pattern = await prisma.orgMappingPattern.findFirst({
            where: {
                organizationId: orgId,
                excelHeaderNormalized: normalizedHeader,
                systemField,
            },
            orderBy: [{ successRate: 'desc' }, { usageCount: 'desc' }],
        });
        if (pattern) {
            return pattern.successRate * 0.15; // Max 15% boost
        }
    } catch (error) {
        console.error('Error fetching org patterns:', error);
    }
    return 0;
}

/**
 * Context-aware similarity calculation with multiple factors.
 */
async function calculateSimilarity(
    excelHeader: string, systemField: string, orgId: string | null
): Promise<number> {
    const fieldConfig = FIELD_DICTIONARY[systemField];
    if (!fieldConfig) return 0;

    const normalizedExcel = normalizeHeader(excelHeader);
    let baseScore = 0;

    // Factor 1: Exact keyword match (highest weight)
    for (const keyword of fieldConfig.keywords) {
        const normalizedKeyword = keyword.replace(/\s+/g, '_');
        if (normalizedExcel === normalizedKeyword) {
            baseScore = Math.max(baseScore, 0.95);
        } else if (normalizedExcel.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedExcel)) {
            baseScore = Math.max(baseScore, 0.80);
        }
    }

    // Factor 2: Fuzzy matching for partial matches
    if (baseScore < 0.80) {
        const fuse = new Fuse(fieldConfig.keywords, { threshold: 0.4 });
        const results = fuse.search(excelHeader.toLowerCase().trim());
        if (results.length > 0 && results[0].score !== undefined) {
            const fuzzyScore = (1 - results[0].score) * 0.7;
            baseScore = Math.max(baseScore, fuzzyScore);
        }
    }

    // Factor 3: Organization pattern boost (learned mappings)
    if (orgId) {
        const orgBoost = await getOrgPatternBoost(orgId, normalizedExcel, systemField);
        baseScore = Math.min(1.0, baseScore + orgBoost);
    }

    // Factor 4: Priority weighting (critical fields get threshold boost)
    const priorityWeight = (6 - fieldConfig.priority) / 5; // Priority 1 = 1.0, Priority 5 = 0.2
    baseScore = baseScore * (0.7 + 0.3 * priorityWeight);

    // Factor 5: Narrow vision penalty for uncertain critical field matches
    if (fieldConfig.narrowVision && baseScore < 0.7) {
        baseScore = baseScore * 0.8;
    }

    return Math.round(baseScore * 100) / 100;
}

/**
 * Generate intelligent mapping suggestions with confidence scores.
 */
async function generateSmartMappingV2(
    excelHeaders: string[],
    orgId: string | null,
    options: { strictMode?: boolean; minConfidence?: number; requireConfirmationBelow?: number } = {}
): Promise<SmartMappingResult> {
    const { strictMode = false, minConfidence = 0.35, requireConfirmationBelow = 0.7 } = options;

    const matched: Record<string, MappingSuggestion> = {};
    const usedHeaders = new Set<string>();
    const confidenceScores: number[] = [];

    // Process each system field in priority order
    const sortedFields = Object.entries(FIELD_DICTIONARY)
        .sort((a, b) => a[1].priority - b[1].priority);

    for (const [systemField, config] of sortedFields) {
        let bestScore = 0;
        let bestHeader: string | null = null;

        for (const header of excelHeaders) {
            if (usedHeaders.has(header)) continue;

            const score = await calculateSimilarity(header, systemField, orgId);

            const effectiveThreshold = (strictMode && config.narrowVision)
                ? Math.max(minConfidence, 0.7)
                : minConfidence;

            if (score > bestScore && score >= effectiveThreshold) {
                bestScore = score;
                bestHeader = header;
            }
        }

        if (bestHeader) {
            matched[systemField] = { excelHeader: bestHeader, confidence: bestScore };
            confidenceScores.push(bestScore);
            usedHeaders.add(bestHeader);
        }
    }

    const averageConfidence = confidenceScores.length > 0
        ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 100) / 100
        : 0;

    const requiresManualReview = confidenceScores.some(s => s < requireConfirmationBelow)
        || REQUIRED_FIELDS.some(f => !matched[f]);

    return {
        matched,
        unmappedSystemFields: Object.keys(FIELD_DICTIONARY).filter(f => !matched[f]),
        unmatchedExcelColumns: excelHeaders.filter(h => !usedHeaders.has(h)),
        missingRequired: REQUIRED_FIELDS.filter(f => !matched[f]),
        allExcelHeaders: excelHeaders,
        averageConfidence,
        requiresManualReview,
    };
}

// Legacy: simple exact-match for rapid fallback
function generateSmartMapping(excelHeaders: string[]) {
    const norm = (s: string) => String(s || '').toLowerCase().trim()
        .replace(/[_\-\/\\]+/g, ' ').replace(/\s+/g, ' ');
    const normHeaders = excelHeaders.map(norm);
    const matched: Record<string, { excelHeader: string; confidence: string }> = {};
    const usedExcel = new Set<string>();

    for (const [field, config] of Object.entries(FIELD_DICTIONARY)) {
        for (const kw of config.keywords) {
            const idx = normHeaders.indexOf(norm(kw));
            if (idx !== -1 && !usedExcel.has(excelHeaders[idx])) {
                matched[field] = { excelHeader: excelHeaders[idx], confidence: 'EXACT' };
                usedExcel.add(excelHeaders[idx]);
                break;
            }
        }
    }
    return {
        matched,
        unmappedSystemFields: Object.keys(FIELD_DICTIONARY).filter(f => !matched[f]),
        unmatchedExcelColumns: excelHeaders.filter(h => !usedExcel.has(h)),
        missingRequired: REQUIRED_FIELDS.filter(f => !matched[f]),
        allExcelHeaders: excelHeaders,
    };
}

// ─── COLUMN MAPPING (Fuse.js) ───────────────────────────────────────────────────

const columnMappings = Object.entries(FIELD_DICTIONARY).map(([field, config]) => ({
    field,
    aliases: config.keywords.map(k => k.split('_').join(' ')),
}));

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

// ─── ROUTES ─────────────────────────────────────────────────────────────────────

// ── POST /analyze — Intelligent mapping with confidence ──────────────────────
router.post('/analyze', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { headers, orgId } = req.body;

        if (!headers || !Array.isArray(headers)) {
            return res.status(400).json({ success: false, error: 'Headers array is required' });
        }

        const effectiveOrgId = orgId || req.user!.organizationId;

        const mappingResult = await generateSmartMappingV2(headers, effectiveOrgId, {
            strictMode: req.query.strict === 'true',
            minConfidence: parseFloat(req.query.minConfidence as string) || 0.35,
        });

        res.json({ success: true, data: mappingResult });
    } catch (error) {
        console.error('Error analyzing import:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze import file' });
    }
});

// ── POST /feedback — Record user corrections for learning ────────────────────
router.post('/feedback', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { mappings, orgId } = req.body;
        const effectiveOrgId = orgId || req.user!.organizationId;

        if (!mappings || !Array.isArray(mappings)) {
            return res.status(400).json({ success: false, error: 'Mappings array is required' });
        }

        const results = [];
        for (const mapping of mappings) {
            const { excelHeader, systemField, wasCorrect, confidenceScore } = mapping;
            if (!excelHeader || !systemField) continue;

            const normalizedHeader = normalizeHeader(excelHeader);

            // Insert feedback record
            await prisma.mappingFeedback.create({
                data: {
                    organizationId: effectiveOrgId,
                    excelHeaderOriginal: excelHeader,
                    excelHeaderNormalized: normalizedHeader,
                    mappedSystemField: systemField,
                    wasCorrect: !!wasCorrect,
                    confidenceScore: confidenceScore ?? null,
                },
            });

            // Upsert organization pattern
            const existing = await prisma.orgMappingPattern.findUnique({
                where: {
                    organizationId_excelHeaderNormalized_systemField: {
                        organizationId: effectiveOrgId,
                        excelHeaderNormalized: normalizedHeader,
                        systemField,
                    },
                },
            });

            if (existing) {
                const newCount = existing.usageCount + 1;
                const newRate = ((existing.successRate * existing.usageCount) + (wasCorrect ? 1 : 0)) / newCount;
                await prisma.orgMappingPattern.update({
                    where: { id: existing.id },
                    data: {
                        usageCount: newCount,
                        successRate: Math.round(newRate * 100) / 100,
                        lastUsedAt: new Date(),
                    },
                });
            } else {
                await prisma.orgMappingPattern.create({
                    data: {
                        organizationId: effectiveOrgId,
                        excelHeaderNormalized: normalizedHeader,
                        systemField,
                        usageCount: 1,
                        successRate: wasCorrect ? 1.0 : 0.0,
                        lastUsedAt: new Date(),
                    },
                });
            }

            results.push({ excelHeader, systemField, recorded: true });
        }

        res.json({ success: true, message: 'Feedback recorded successfully', data: results });
    } catch (error) {
        console.error('Error recording feedback:', error);
        res.status(500).json({ success: false, error: 'Failed to record feedback' });
    }
});

// ── GET /stats — Mapping accuracy stats for organization ─────────────────────
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;

        const feedbacks = await prisma.mappingFeedback.findMany({
            where: { organizationId: orgId },
        });

        const total = feedbacks.length;
        const correct = feedbacks.filter((f: { wasCorrect: boolean }) => f.wasCorrect).length;
        const avgConfidence = total > 0
            ? Math.round((feedbacks.reduce((sum: number, f: { confidenceScore: number | null }) => sum + (f.confidenceScore || 0), 0) / total) * 100) / 100
            : 0;
        const accuracyRate = total > 0
            ? Math.round((correct / total) * 10000) / 100
            : 0;

        res.json({
            success: true,
            data: {
                totalFeedbacks: total,
                correctMappings: correct,
                avgConfidence,
                accuracyRate,
            },
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// ── POST /upload — Upload and import Excel ───────────────────────────────────
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
                                city: getCellValue('city') || null,
                                pincode: getCellValue('pincode') || null,
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
                        const depMethodVal = getCellValue('depMethod') || 'STRAIGHT_LINE';
                        const usefulLife = parseInt(getCellValue('usefulLife')) || 5;
                        const salvagePercent = parseFloat(getCellValue('salvageValue')) || 10;
                        atype = await prisma.assetType.create({
                            data: { name: typeName, depreciationMethod: depMethodVal, usefulLifeYears: usefulLife, salvageValuePercent: salvagePercent, organizationId: orgId }
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
                            } else if (method === 'SUM_OF_YEARS_DIGITS') {
                                const syd = (atype.usefulLifeYears * (atype.usefulLifeYears + 1)) / 2;
                                const firstYearDep = (atype.usefulLifeYears / syd) * (purchasePrice - salvageValue);
                                depAmount = firstYearDep / 12;
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

// ── GET /history — Import history ────────────────────────────────────────────
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

// ── GET /:jobId/errors — Download import errors ──────────────────────────────
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

// ── GET /download — Download template ────────────────────────────────────────
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

        const headerRow2 = ws.getRow(1);
        headerRow2.eachCell((cell, colNumber) => {
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

        ws.addRow([
            'Dell Latitude 5520', 'Laptop', 'Dell', 'DL-001234', 'HQ Mumbai',
            '2024-01-15', 85000, 1, 'ACTIVE',
            'Dell India Pvt Ltd', 'sales@dell.in', '9876543210', 'Plot 1, Tech Park',
            'Mumbai', '400001', '14" Business Laptop i7', '2027-01-15',
            'John Doe', 'Standard IT Policy', 5, 10, 'STRAIGHT_LINE'
        ]);

        ws.columns.forEach(col => { col.width = 20; });

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
        instrWs.addRow(['Depreciation Method', 'No', 'STRAIGHT_LINE, DECLINING_BALANCE, SUM_OF_YEARS_DIGITS']);
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

// ── POST /upload-preview — Smart mapping for MappingWizard ───────────────────
router.post('/upload-preview', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const ws = workbook.worksheets[0];

        const headers: string[] = [];
        ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
            headers[colNum - 1] = String(cell.value || '').trim();
        });

        const previewRows: any[] = [];
        for (let r = 2; r <= Math.min(4, ws.rowCount); r++) {
            const row = ws.getRow(r);
            const rowData: Record<string, any> = {};
            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                if (headers[colNum - 1]) rowData[headers[colNum - 1]] = cell.value;
            });
            previewRows.push(rowData);
        }

        // Use intelligent V2 mapping with org patterns
        const orgId = req.user!.organizationId;
        const mapping = await generateSmartMappingV2(headers, orgId);

        res.json({
            success: true,
            data: {
                filePath: req.file.path,
                fileName: req.file.originalname,
                totalRows: ws.rowCount - 1,
                headers,
                previewRows,
                mapping,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Preview failed' });
    }
});

// ── POST /preview — Column mapping preview ───────────────────────────────────
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
