import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // 1. Organization
    const org = await prisma.organization.create({
        data: {
            name: 'Demo Corporation Pvt. Ltd.',
            address: '123 Business Park, Mumbai, Maharashtra 400001',
            settings: JSON.stringify({
                currency: 'INR',
                dateFormat: 'DD/MM/YYYY',
                fiscalYearStart: 4,
                assetCodePrefix: 'AST',
                assetCodePadding: 5,
                warrantyAlertDays: 30,
                lowStockThreshold: 5
            })
        }
    });
    console.log('✅ Organization created');

    // 2. Users
    const adminPassword = await bcrypt.hash('Admin@123', 10);
    const managerPassword = await bcrypt.hash('Manager@123', 10);
    const viewerPassword = await bcrypt.hash('Viewer@123', 10);

    const admin = await prisma.user.create({
        data: { name: 'Admin User', email: 'admin@demo.com', password: adminPassword, role: 'ADMIN', organizationId: org.id }
    });
    const manager = await prisma.user.create({
        data: { name: 'Manager User', email: 'manager@demo.com', password: managerPassword, role: 'MANAGER', organizationId: org.id }
    });
    const viewer = await prisma.user.create({
        data: { name: 'Viewer User', email: 'viewer@demo.com', password: viewerPassword, role: 'VIEWER', organizationId: org.id }
    });
    const tech = await prisma.user.create({
        data: { name: 'Tech Support', email: 'tech@demo.com', password: await bcrypt.hash('Tech@123', 10), role: 'TECHNICIAN', organizationId: org.id }
    });
    console.log('✅ Users created');

    // 3. Branches
    const branches = await Promise.all([
        prisma.branch.create({ data: { name: 'HQ Mumbai', location: 'Head Office', address: '123 Business Park, Andheri East', city: 'Mumbai', pincode: '400069', organizationId: org.id } }),
        prisma.branch.create({ data: { name: 'Delhi Office', location: 'North Region', address: '456 Connaught Place', city: 'Delhi', pincode: '110001', organizationId: org.id } }),
        prisma.branch.create({ data: { name: 'Bangalore Office', location: 'South Region', address: '789 Electronic City', city: 'Bangalore', pincode: '560100', organizationId: org.id } }),
        prisma.branch.create({ data: { name: 'Pune Warehouse', location: 'Storage', address: '321 Hinjewadi IT Park', city: 'Pune', pincode: '411057', organizationId: org.id } }),
        prisma.branch.create({ data: { name: 'Chennai Branch', location: 'Tamil Nadu', address: '654 OMR Road', city: 'Chennai', pincode: '600119', organizationId: org.id } }),
    ]);
    console.log('✅ Branches created');

    // 4. Brands
    const brands = await Promise.all([
        prisma.brand.create({ data: { name: 'Dell', website: 'https://dell.com', description: 'Dell Technologies', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'HP', website: 'https://hp.com', description: 'Hewlett-Packard', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Apple', website: 'https://apple.com', description: 'Apple Inc.', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Samsung', website: 'https://samsung.com', description: 'Samsung Electronics', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Lenovo', website: 'https://lenovo.com', description: 'Lenovo Group', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Cisco', website: 'https://cisco.com', description: 'Cisco Systems', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Herman Miller', website: 'https://hermanmiller.com', description: 'Office Furniture', organizationId: org.id } }),
        prisma.brand.create({ data: { name: 'Daikin', website: 'https://daikin.com', description: 'Air Conditioning', organizationId: org.id } }),
    ]);
    console.log('✅ Brands created');

    // 5. Suppliers
    const suppliers = await Promise.all([
        prisma.supplier.create({ data: { companyName: 'TechWorld Solutions Pvt Ltd', contactPerson: 'Rahul Sharma', email: 'rahul@techworld.in', phone: '9876543210', address: 'Plot 5, MIDC', city: 'Mumbai', pincode: '400093', website: 'https://techworld.in', organizationId: org.id } }),
        prisma.supplier.create({ data: { companyName: 'Digital India Enterprises', contactPerson: 'Priya Patel', email: 'priya@digitalindia.co.in', phone: '9876543211', address: '12 Nehru Place', city: 'Delhi', pincode: '110019', organizationId: org.id } }),
        prisma.supplier.create({ data: { companyName: 'South IT Distribution', contactPerson: 'Karthik Reddy', email: 'karthik@southit.com', phone: '9876543212', address: '88 HSR Layout', city: 'Bangalore', pincode: '560102', organizationId: org.id } }),
        prisma.supplier.create({ data: { companyName: 'Office Plus Furnishings', contactPerson: 'Amit Desai', email: 'amit@officeplus.in', phone: '9876543213', address: '45 FC Road', city: 'Pune', pincode: '411004', organizationId: org.id } }),
        prisma.supplier.create({ data: { companyName: 'CoolAir Systems', contactPerson: 'Lakshmi Iyer', email: 'lakshmi@coolair.in', phone: '9876543214', address: '67 Anna Salai', city: 'Chennai', pincode: '600002', organizationId: org.id } }),
    ]);
    console.log('✅ Suppliers created');

    // 6. Asset Types (existing + 7 standard Indian types from Spec v2)
    const assetTypes = await Promise.all([
        prisma.assetType.create({ data: { name: 'Laptop', description: 'Portable computers', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 4, salvageValuePercent: 10, annualDepreciationRate: 22.5, status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Desktop', description: 'Desktop computers and workstations', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 5, salvageValuePercent: 10, annualDepreciationRate: 18, status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Server', description: 'Enterprise servers', depreciationMethod: 'DECLINING_BALANCE', usefulLifeYears: 7, salvageValuePercent: 5, annualDepreciationRate: 33.98, status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Printer', description: 'Printers and scanners', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 5, salvageValuePercent: 10, annualDepreciationRate: 18, status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Office Furniture', description: 'Desks, chairs, cabinets', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 10, salvageValuePercent: 5, annualDepreciationRate: 9.5, status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Air Conditioner', description: 'HVAC systems', depreciationMethod: 'DECLINING_BALANCE', usefulLifeYears: 8, salvageValuePercent: 10, annualDepreciationRate: 25.08, status: 'approved', organizationId: org.id } }),
        // Standard Indian asset categories from Companies Act
        prisma.assetType.create({ data: { name: 'Plant & Machinery', description: 'Industrial machinery and equipment', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 15, salvageValuePercent: 5, annualDepreciationRate: 6.33, codePrefix: 'PM', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Office Equipments', description: 'Office devices, peripherals, etc.', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 5, salvageValuePercent: 5, annualDepreciationRate: 19, codePrefix: 'OE', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Computer', description: 'Desktops, laptops, tablets', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 3, salvageValuePercent: 5, annualDepreciationRate: 31.67, codePrefix: 'COMP', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Building', description: 'Commercial and industrial buildings', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 30, salvageValuePercent: 10, annualDepreciationRate: 3, codePrefix: 'BLD', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Pipeline and Bridges', description: 'Infrastructure assets', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 30, salvageValuePercent: 5, annualDepreciationRate: 3.17, codePrefix: 'PAB', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Electrical Fitting', description: 'Wiring, switchboards, transformers', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 10, salvageValuePercent: 5, annualDepreciationRate: 9.5, codePrefix: 'EF', status: 'approved', organizationId: org.id } }),
        prisma.assetType.create({ data: { name: 'Furniture and Fixture', description: 'Office furniture, fixtures, fittings', depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 10, salvageValuePercent: 10, annualDepreciationRate: 9, codePrefix: 'FAF', status: 'approved', organizationId: org.id } }),
    ]);
    console.log('✅ Asset Types created (13 types including 7 standard Indian categories)');

    // 7. Assets (50 sample assets)
    const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'];
    const assetData = [
        // Laptops (15)
        ...Array.from({ length: 15 }, (_, i) => ({
            name: ['Dell Latitude 5520', 'HP EliteBook 840', 'Apple MacBook Pro 14"', 'Lenovo ThinkPad X1', 'Dell Inspiron 15', 'HP ProBook 450', 'Apple MacBook Air M2', 'Lenovo Yoga 7i', 'Dell XPS 13', 'HP Spectre x360', 'Lenovo IdeaPad 5', 'Dell Latitude 7430', 'HP EliteBook 1040', 'Apple MacBook Pro 16"', 'Lenovo ThinkPad T14s'][i],
            serial: `LPT-${2024}${String(i + 1).padStart(4, '0')}`,
            price: [85000, 92000, 180000, 120000, 65000, 72000, 145000, 95000, 130000, 155000, 58000, 110000, 140000, 220000, 115000][i],
            brandIdx: [0, 1, 2, 4, 0, 1, 2, 4, 0, 1, 4, 0, 1, 2, 4][i],
            typeIdx: 0,
            branchIdx: i % 5,
            daysAgo: Math.floor(Math.random() * 1800) + 30,
        })),
        // Desktops (10)
        ...Array.from({ length: 10 }, (_, i) => ({
            name: ['Dell OptiPlex 7090', 'HP ProDesk 400', 'Lenovo ThinkCentre M90q', 'Dell Precision 5860', 'HP Z4 Workstation', 'Dell OptiPlex 5090', 'HP EliteDesk 800', 'Lenovo ThinkStation P360', 'Dell Vostro 3710', 'HP Pro Tower 400'][i],
            serial: `DSK-${2023}${String(i + 1).padStart(4, '0')}`,
            price: [75000, 68000, 72000, 180000, 220000, 58000, 85000, 150000, 45000, 62000][i],
            brandIdx: [0, 1, 4, 0, 1, 0, 1, 4, 0, 1][i],
            typeIdx: 1,
            branchIdx: i % 5,
            daysAgo: Math.floor(Math.random() * 1800) + 180,
        })),
        // Servers (5)
        ...Array.from({ length: 5 }, (_, i) => ({
            name: ['Dell PowerEdge R750', 'HP ProLiant DL380', 'Cisco UCS C220 M6', 'Dell PowerEdge R650', 'HP ProLiant DL360'][i],
            serial: `SRV-${2022}${String(i + 1).padStart(4, '0')}`,
            price: [450000, 520000, 480000, 380000, 410000][i],
            brandIdx: [0, 1, 5, 0, 1][i],
            typeIdx: 2,
            branchIdx: [0, 1, 2, 0, 2][i],
            daysAgo: Math.floor(Math.random() * 1000) + 365,
        })),
        // Printers (5)
        ...Array.from({ length: 5 }, (_, i) => ({
            name: ['HP LaserJet Pro M404', 'Samsung Xpress M2835', 'HP Color LaserJet Pro', 'Dell B2375', 'HP OfficeJet Pro 9025'][i],
            serial: `PRT-${2023}${String(i + 1).padStart(4, '0')}`,
            price: [35000, 22000, 55000, 28000, 18000][i],
            brandIdx: [1, 3, 1, 0, 1][i],
            typeIdx: 3,
            branchIdx: i % 5,
            daysAgo: Math.floor(Math.random() * 1200) + 200,
        })),
        // Office Furniture (10)
        ...Array.from({ length: 10 }, (_, i) => ({
            name: ['Herman Miller Aeron Chair', 'Executive Desk Oak', 'Conference Table 12-seat', 'Filing Cabinet 4-drawer', 'Standing Desk Electric', 'Herman Miller Sayl Chair', 'Bookshelf Walnut', 'Reception Counter', 'Ergonomic Keyboard Tray', 'Whiteboard 6x4ft'][i],
            serial: `FRN-${2021}${String(i + 1).padStart(4, '0')}`,
            price: [95000, 45000, 120000, 15000, 55000, 65000, 25000, 85000, 8000, 12000][i],
            brandIdx: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6][i],
            typeIdx: 4,
            branchIdx: i % 5,
            daysAgo: Math.floor(Math.random() * 1500) + 400,
        })),
        // Air Conditioners (5)
        ...Array.from({ length: 5 }, (_, i) => ({
            name: ['Daikin Split AC 1.5 Ton', 'Daikin Cassette AC 3 Ton', 'Daikin Tower AC 2 Ton', 'Daikin Window AC 1 Ton', 'Daikin VRV System'][i],
            serial: `AC-${2022}${String(i + 1).padStart(4, '0')}`,
            price: [48000, 125000, 75000, 32000, 350000][i],
            brandIdx: [7, 7, 7, 7, 7][i],
            typeIdx: 5,
            branchIdx: i % 5,
            daysAgo: Math.floor(Math.random() * 1200) + 300,
        })),
    ];

    const createdAssets = [];
    for (let i = 0; i < assetData.length; i++) {
        const d = assetData[i];
        const purchaseDate = new Date(Date.now() - d.daysAgo * 24 * 60 * 60 * 1000);
        const warrantyDate = new Date(purchaseDate);
        warrantyDate.setFullYear(warrantyDate.getFullYear() + 3);

        const asset = await prisma.asset.create({
            data: {
                assetCode: `AST-${String(i + 1).padStart(5, '0')}`,
                name: d.name,
                serialNumber: d.serial,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                purchaseDate,
                purchasePrice: d.price,
                currentValue: d.price,
                warrantyExpiryDate: warrantyDate,
                branchId: branches[d.branchIdx].id,
                brandId: brands[d.brandIdx].id,
                supplierId: suppliers[d.branchIdx % suppliers.length].id,
                assetTypeId: assetTypes[d.typeIdx].id,
                organizationId: org.id,
                assignedToUserId: [admin.id, manager.id, viewer.id, tech.id][i % 4],
                quantity: 1,
                tags: '[]',
            }
        });

        createdAssets.push(asset);

        // Create inventory record
        await prisma.inventoryRecord.create({
            data: {
                assetId: asset.id,
                branchId: branches[d.branchIdx].id,
                quantity: Math.floor(Math.random() * 10) + 1,
                minStockLevel: 2,
                maxStockLevel: 20,
                lastAuditDate: new Date(),
                auditedBy: 'System Seed'
            }
        });
    }
    console.log(`✅ ${createdAssets.length} Assets created with inventory records`);

    // 8. Generate depreciation schedules for all assets
    for (const asset of createdAssets) {
        const assetType = assetTypes.find(at => at.id === asset.assetTypeId);
        if (!assetType || !asset.purchaseDate) continue;

        const salvageValue = asset.purchasePrice * (assetType.salvageValuePercent / 100);
        const usefulMonths = assetType.usefulLifeYears * 12;
        let openingValue = asset.purchasePrice;
        let cumDep = 0;

        const startDate = new Date(asset.purchaseDate);
        const now = new Date();
        let monthsToGenerate = Math.min(
            usefulMonths,
            (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1
        );

        for (let m = 0; m < monthsToGenerate; m++) {
            const depDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
            let depAmount = 0;

            if (assetType.depreciationMethod === 'STRAIGHT_LINE') {
                depAmount = (asset.purchasePrice - salvageValue) / usefulMonths;
            } else if (assetType.depreciationMethod === 'DECLINING_BALANCE') {
                const rate = 1 - Math.pow(salvageValue / asset.purchasePrice, 1 / assetType.usefulLifeYears);
                depAmount = (openingValue * rate) / 12;
            } else {
                depAmount = (asset.purchasePrice - salvageValue) / usefulMonths;
            }

            const closingValue = Math.max(salvageValue, openingValue - depAmount);
            depAmount = openingValue - closingValue;
            cumDep += depAmount;

            await prisma.depreciationSchedule.create({
                data: {
                    assetId: asset.id,
                    year: depDate.getFullYear(),
                    month: depDate.getMonth() + 1,
                    openingValue,
                    depreciationAmount: Math.round(depAmount * 100) / 100,
                    closingValue: Math.round(closingValue * 100) / 100,
                    cumulativeDepreciation: Math.round(cumDep * 100) / 100,
                    method: assetType.depreciationMethod,
                    rate: assetType.depreciationMethod === 'DECLINING_BALANCE'
                        ? (1 - Math.pow(salvageValue / asset.purchasePrice, 1 / assetType.usefulLifeYears)) * 100
                        : 100 / assetType.usefulLifeYears
                }
            });

            openingValue = closingValue;
            if (openingValue <= salvageValue) break;
        }

        // Update current value
        await prisma.asset.update({
            where: { id: asset.id },
            data: { currentValue: Math.round(openingValue * 100) / 100 }
        });
    }
    console.log('✅ Depreciation schedules generated');

    // 9. Some maintenance records
    const maintenanceData = [
        { assetIdx: 0, type: 'PREVENTIVE', desc: 'Annual hardware checkup', cost: 2500, status: 'COMPLETED', daysAgo: 90 },
        { assetIdx: 2, type: 'CORRECTIVE', desc: 'Battery replacement', cost: 15000, status: 'COMPLETED', daysAgo: 60 },
        { assetIdx: 5, type: 'PREVENTIVE', desc: 'OS Update and cleanup', cost: 1000, status: 'COMPLETED', daysAgo: 45 },
        { assetIdx: 15, type: 'CORRECTIVE', desc: 'Hard drive replacement', cost: 8000, status: 'IN_PROGRESS', daysAgo: 7 },
        { assetIdx: 25, type: 'PREVENTIVE', desc: 'Server maintenance window', cost: 5000, status: 'PENDING', daysAgo: -7 },
        { assetIdx: 30, type: 'EMERGENCY', desc: 'Printer paper jam fix', cost: 3000, status: 'COMPLETED', daysAgo: 30 },
        { assetIdx: 35, type: 'PREVENTIVE', desc: 'Chair hydraulic check', cost: 2000, status: 'PENDING', daysAgo: -14 },
        { assetIdx: 40, type: 'CORRECTIVE', desc: 'AC gas refill', cost: 4500, status: 'COMPLETED', daysAgo: 20 },
        { assetIdx: 10, type: 'PREVENTIVE', desc: 'Keyboard and trackpad cleaning', cost: 500, status: 'COMPLETED', daysAgo: 120 },
        { assetIdx: 20, type: 'EMERGENCY', desc: 'Server crash recovery', cost: 25000, status: 'COMPLETED', daysAgo: 200 },
    ];

    for (const m of maintenanceData) {
        const scheduledDate = new Date(Date.now() - m.daysAgo * 24 * 60 * 60 * 1000);
        await prisma.maintenanceLog.create({
            data: {
                assetId: createdAssets[m.assetIdx].id,
                type: m.type,
                scheduledDate,
                completedDate: m.status === 'COMPLETED' ? new Date(scheduledDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
                cost: m.cost,
                technicianId: tech.id,
                description: m.desc,
                status: m.status,
                organizationId: org.id,
                nextMaintenanceDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            }
        });
    }
    console.log('✅ Maintenance records created');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('  Admin:     admin@demo.com / Admin@123');
    console.log('  Manager:   manager@demo.com / Manager@123');
    console.log('  Viewer:    viewer@demo.com / Viewer@123');
    console.log('  Technician: tech@demo.com / Tech@123');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
