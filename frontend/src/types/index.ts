export interface Asset {
    id: string;
    assetCode: string;
    name: string;
    description?: string;
    serialNumber?: string;
    status: string;
    purchaseDate?: string;
    purchasePrice: number;
    currentValue: number;
    warrantyExpiryDate?: string;
    location?: string;
    branchId?: string;
    brandId?: string;
    supplierId?: string;
    assetTypeId?: string;
    organizationId: string;
    assignedToUserId?: string;
    tenderId?: string;
    photoUrl?: string;
    quantity: number;
    unit?: string;
    tags?: string;
    companyPolicyNotes?: string;
    createdAt: string;
    updatedAt: string;
    branch?: { id: string; name: string };
    brand?: { id: string; name: string };
    supplier?: { id: string; companyName: string };
    assetType?: { id: string; name: string };
    assignedTo?: { id: string; name: string };
    tender?: { id: string; tenderNumber: string; tenderName: string };
}

export interface Brand {
    id: string;
    name: string;
    logo?: string;
    website?: string;
    description?: string;
    _count?: { assets: number; assetTypes: number };
}

export interface Supplier {
    id: string;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    pincode?: string;
    website?: string;
    _count?: { assets: number };
}

export interface AssetType {
    id: string;
    name: string;
    description?: string;
    depreciationMethod: string;
    usefulLifeYears: number;
    salvageValuePercent: number;
    _count?: { assets: number };
    brand?: { name: string };
}

export interface Branch {
    id: string;
    name: string;
    location?: string;
    address?: string;
    city?: string;
    pincode?: string;
}

export interface MaintenanceLog {
    id: string;
    assetId: string;
    type: string;
    scheduledDate: string;
    completedDate?: string;
    cost: number;
    technicianId?: string;
    description?: string;
    status: string;
    nextMaintenanceDate?: string;
    asset?: { id: string; name: string; assetCode: string };
    technician?: { id: string; name: string };
}

export interface InventoryRecord {
    id: string;
    assetId: string;
    branchId: string;
    quantity: number;
    minStockLevel: number;
    maxStockLevel: number;
    lastAuditDate?: string;
    notes?: string;
    asset?: { id: string; name: string; assetCode: string; status: string };
    branch?: { id: string; name: string };
}

export interface ImportJob {
    id: string;
    fileName: string;
    status: string;
    totalRows: number;
    processedRows: number;
    errorRows: number;
    createdAt: string;
    completedAt?: string;
    user?: { name: string };
}

export interface DashboardStats {
    totalAssets: number;
    totalValue: number;
    underMaintenance: number;
    warrantyExpiring: number;
    lowStock: number;
    fullyDepreciated: number;
    activeAssets: number;
}
