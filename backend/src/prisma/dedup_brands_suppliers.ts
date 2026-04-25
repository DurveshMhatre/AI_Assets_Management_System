import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    // Check for duplicate brands
    const dupBrands = await p.$queryRawUnsafe(
        `SELECT organizationId, nameLower, COUNT(*) as cnt FROM Brand GROUP BY organizationId, nameLower HAVING cnt > 1`
    );
    console.log('Duplicate brands:', dupBrands);

    // Check for duplicate suppliers
    const dupSuppliers = await p.$queryRawUnsafe(
        `SELECT organizationId, companyNameLower, COUNT(*) as cnt FROM Supplier GROUP BY organizationId, companyNameLower HAVING cnt > 1`
    );
    console.log('Duplicate suppliers:', dupSuppliers);

    // If duplicates exist, merge them (keep the first, reassign assets from others)
    if (Array.isArray(dupBrands) && (dupBrands as any[]).length > 0) {
        for (const dup of dupBrands as any[]) {
            const dupes = await p.brand.findMany({
                where: { organizationId: dup.organizationId, nameLower: dup.nameLower },
                orderBy: { createdAt: 'asc' },
            });
            const keeper = dupes[0];
            for (let i = 1; i < dupes.length; i++) {
                console.log(`  Merging brand "${dupes[i].name}" into "${keeper.name}"`);
                await p.asset.updateMany({ where: { brandId: dupes[i].id }, data: { brandId: keeper.id } });
                await p.brand.delete({ where: { id: dupes[i].id } });
            }
        }
        console.log('✅ Brand duplicates merged');
    } else {
        console.log('✅ No duplicate brands found');
    }

    if (Array.isArray(dupSuppliers) && (dupSuppliers as any[]).length > 0) {
        for (const dup of dupSuppliers as any[]) {
            const dupes = await p.supplier.findMany({
                where: { organizationId: dup.organizationId, companyNameLower: dup.companyNameLower },
                orderBy: { createdAt: 'asc' },
            });
            const keeper = dupes[0];
            for (let i = 1; i < dupes.length; i++) {
                console.log(`  Merging supplier "${dupes[i].companyName}" into "${keeper.companyName}"`);
                await p.asset.updateMany({ where: { supplierId: dupes[i].id }, data: { supplierId: keeper.id } });
                await p.supplier.delete({ where: { id: dupes[i].id } });
            }
        }
        console.log('✅ Supplier duplicates merged');
    } else {
        console.log('✅ No duplicate suppliers found');
    }
}

main().catch(console.error).finally(() => p.$disconnect());
