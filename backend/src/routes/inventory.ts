import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY: Asset-linked InventoryRecord endpoints (kept intact)
// ═══════════════════════════════════════════════════════════════════════════

// List inventory records (asset-linked)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const branchId = req.query.branchId as string;
        const where: any = { asset: { organizationId: orgId } };
        if (branchId) where.branchId = branchId;

        const records = await prisma.inventoryRecord.findMany({
            where,
            include: {
                asset: { select: { id: true, name: true, assetCode: true, status: true } },
                branch: { select: { id: true, name: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Summary stats
        const totalSkus = records.length;
        const totalStockValue = records.reduce((sum, r) => sum + r.quantity, 0);
        const lowStock = records.filter(r => r.quantity <= r.minStockLevel).length;
        const outOfStock = records.filter(r => r.quantity === 0).length;

        res.json({
            success: true,
            data: records,
            summary: { totalSkus, totalStockValue, lowStock, outOfStock }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Adjust stock (asset-linked)
router.put('/:id/adjust', async (req: AuthRequest, res: Response) => {
    try {
        const { quantity, notes } = req.body;
        const record = await prisma.inventoryRecord.update({
            where: { id: req.params.id },
            data: {
                quantity: parseInt(quantity),
                notes,
                lastAuditDate: new Date(),
                auditedBy: req.user!.name
            },
            include: {
                asset: { select: { name: true } },
                branch: { select: { name: true } }
            }
        });
        res.json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Standalone Inventory CRUD (InventoryItem + Categories + Transactions)
// ═══════════════════════════════════════════════════════════════════════════

// ── CATEGORIES ──────────────────────────────────────────────────────────

router.get('/categories', async (req: AuthRequest, res: Response) => {
    try {
        const categories = await prisma.inventoryCategory.findMany({
            where: { organizationId: req.user!.organizationId },
            include: { _count: { select: { items: true } } },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.post('/categories', async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
        const cat = await prisma.inventoryCategory.create({
            data: { name, description: description || null, organizationId: req.user!.organizationId },
        });
        res.status(201).json({ success: true, data: cat });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.put('/categories/:id', async (req: AuthRequest, res: Response) => {
    try {
        const cat = await prisma.inventoryCategory.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ success: true, data: cat });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
    try {
        const count = await prisma.inventoryItem.count({ where: { categoryId: req.params.id } });
        if (count > 0) return res.status(400).json({ success: false, error: `Cannot delete: ${count} items linked` });
        await prisma.inventoryCategory.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── ITEMS ───────────────────────────────────────────────────────────────

router.get('/items', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.user!.organizationId;
        const { categoryId, search, lowStockOnly } = req.query;

        const where: any = { organizationId: orgId };
        if (categoryId) where.categoryId = categoryId as string;
        if (lowStockOnly === 'true') {
            where.quantity = { lte: prisma.inventoryItem.fields?.minStockLevel || 0 };
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                category: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Apply text search filter in JS (SQLite doesn't have great full-text)
        let filtered = items;
        if (search) {
            const q = (search as string).toLowerCase();
            filtered = items.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.sku?.toLowerCase().includes(q) ||
                i.notes?.toLowerCase().includes(q)
            );
        }

        // Filter low stock in JS if Prisma can't do cross-column compare
        if (lowStockOnly === 'true') {
            filtered = filtered.filter(i => i.quantity <= i.minStockLevel);
        }

        // Summary
        const totalItems = filtered.length;
        const totalValue = filtered.reduce((sum, i) => sum + i.totalValue, 0);
        const lowStock = filtered.filter(i => i.quantity > 0 && i.quantity <= i.minStockLevel).length;
        const outOfStock = filtered.filter(i => i.quantity === 0).length;

        res.json({
            success: true,
            data: filtered,
            summary: { totalItems, totalValue, lowStock, outOfStock },
        });
    } catch (error) {
        console.error('List inventory items error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get('/items/:id', async (req: AuthRequest, res: Response) => {
    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: req.params.id },
            include: {
                category: true,
                transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
        res.json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.post('/items', async (req: AuthRequest, res: Response) => {
    try {
        const { name, sku, categoryId, branchId, quantity, minStockLevel, maxStockLevel, unitPrice, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

        const qty = parseInt(quantity) || 0;
        const price = parseFloat(unitPrice) || 0;

        const item = await prisma.inventoryItem.create({
            data: {
                name,
                sku: sku || null,
                categoryId: categoryId || null,
                branchId: branchId || null,
                quantity: qty,
                minStockLevel: parseInt(minStockLevel) || 0,
                maxStockLevel: parseInt(maxStockLevel) || 100,
                unitPrice: price,
                totalValue: qty * price,
                notes: notes || null,
                organizationId: req.user!.organizationId,
            },
            include: { category: { select: { name: true } } },
        });

        // Log initial stock transaction
        if (qty > 0) {
            await prisma.inventoryTransaction.create({
                data: {
                    inventoryItemId: item.id,
                    type: 'STOCK_IN',
                    quantity: qty,
                    previousQty: 0,
                    newQty: qty,
                    reason: 'Initial stock',
                    performedBy: req.user!.name,
                },
            });
        }

        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Create inventory item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.put('/items/:id', async (req: AuthRequest, res: Response) => {
    try {
        const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ success: false, error: 'Item not found' });

        const { name, sku, categoryId, branchId, quantity, minStockLevel, maxStockLevel, unitPrice, notes } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (sku !== undefined) updateData.sku = sku || null;
        if (categoryId !== undefined) updateData.categoryId = categoryId || null;
        if (branchId !== undefined) updateData.branchId = branchId || null;
        if (minStockLevel !== undefined) updateData.minStockLevel = parseInt(minStockLevel);
        if (maxStockLevel !== undefined) updateData.maxStockLevel = parseInt(maxStockLevel);
        if (notes !== undefined) updateData.notes = notes || null;

        if (unitPrice !== undefined) {
            updateData.unitPrice = parseFloat(unitPrice);
            updateData.totalValue = (quantity !== undefined ? parseInt(quantity) : existing.quantity) * parseFloat(unitPrice);
        }

        if (quantity !== undefined) {
            const newQty = parseInt(quantity);
            updateData.quantity = newQty;
            updateData.totalValue = newQty * (unitPrice !== undefined ? parseFloat(unitPrice) : existing.unitPrice);

            // Log quantity change as transaction
            if (newQty !== existing.quantity) {
                const diff = newQty - existing.quantity;
                await prisma.inventoryTransaction.create({
                    data: {
                        inventoryItemId: existing.id,
                        type: diff > 0 ? 'STOCK_IN' : 'STOCK_OUT',
                        quantity: Math.abs(diff),
                        previousQty: existing.quantity,
                        newQty,
                        reason: 'Manual adjustment',
                        performedBy: req.user!.name,
                    },
                });
            }
        }

        const item = await prisma.inventoryItem.update({
            where: { id: req.params.id },
            data: updateData,
            include: { category: { select: { name: true } } },
        });
        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Update inventory item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.delete('/items/:id', async (req: AuthRequest, res: Response) => {
    try {
        // Delete transactions first
        await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: req.params.id } });
        await prisma.inventoryItem.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── STOCK OPERATIONS ────────────────────────────────────────────────────

router.post('/items/:id/stock-in', async (req: AuthRequest, res: Response) => {
    try {
        const { quantity, reason } = req.body;
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) return res.status(400).json({ success: false, error: 'Positive quantity required' });

        const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

        const newQty = item.quantity + qty;

        await prisma.inventoryTransaction.create({
            data: {
                inventoryItemId: item.id,
                type: 'STOCK_IN',
                quantity: qty,
                previousQty: item.quantity,
                newQty,
                reason: reason || 'Stock in',
                performedBy: req.user!.name,
            },
        });

        const updated = await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: newQty, totalValue: newQty * item.unitPrice },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.post('/items/:id/stock-out', async (req: AuthRequest, res: Response) => {
    try {
        const { quantity, reason } = req.body;
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) return res.status(400).json({ success: false, error: 'Positive quantity required' });

        const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
        if (item.quantity < qty) return res.status(400).json({ success: false, error: 'Insufficient stock' });

        const newQty = item.quantity - qty;

        await prisma.inventoryTransaction.create({
            data: {
                inventoryItemId: item.id,
                type: 'STOCK_OUT',
                quantity: qty,
                previousQty: item.quantity,
                newQty,
                reason: reason || 'Stock out',
                performedBy: req.user!.name,
            },
        });

        const updated = await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: newQty, totalValue: newQty * item.unitPrice },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── TRANSACTIONS HISTORY ────────────────────────────────────────────────

router.get('/items/:id/transactions', async (req: AuthRequest, res: Response) => {
    try {
        const txs = await prisma.inventoryTransaction.findMany({
            where: { inventoryItemId: req.params.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: txs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
