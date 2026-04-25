/**
 * One-time migration script: Populate nameLower / companyNameLower for dedup.
 * Run: npx tsx src/prisma/populate_lower_fields.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Populate Brand.nameLower
    const brands = await prisma.brand.findMany();
    console.log(`Found ${brands.length} brands to update...`);
    for (const b of brands) {
        const nameLower = b.name.toLowerCase().trim();
        await prisma.brand.update({
            where: { id: b.id },
            data: { nameLower },
        });
    }
    console.log('✅ Brand.nameLower populated');

    // Populate Supplier.companyNameLower
    const suppliers = await prisma.supplier.findMany();
    console.log(`Found ${suppliers.length} suppliers to update...`);
    for (const s of suppliers) {
        const companyNameLower = s.companyName.toLowerCase().trim();
        await prisma.supplier.update({
            where: { id: s.id },
            data: { companyNameLower },
        });
    }
    console.log('✅ Supplier.companyNameLower populated');

    // Also populate Asset.minStockLevel / maxStockLevel from InventoryRecord if they exist
    const records = await prisma.inventoryRecord.findMany({
        include: { asset: { select: { id: true, minStockLevel: true, maxStockLevel: true } } },
    });
    console.log(`Found ${records.length} inventory records to sync stock levels...`);
    for (const r of records) {
        await prisma.asset.update({
            where: { id: r.assetId },
            data: {
                minStockLevel: r.minStockLevel,
                maxStockLevel: r.maxStockLevel,
            },
        });
    }
    console.log('✅ Asset stock levels synced from InventoryRecords');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
