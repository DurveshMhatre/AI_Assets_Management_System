export const PERMISSIONS = {
  VIEW_ASSETS:       'VIEW_ASSETS',
  EDIT_ASSETS:       'EDIT_ASSETS',
  DELETE_ASSETS:     'DELETE_ASSETS',
  VIEW_INVENTORY:    'VIEW_INVENTORY',
  EDIT_INVENTORY:    'EDIT_INVENTORY',
  VIEW_REPORTS:      'VIEW_REPORTS',
  APPROVE_REPORTS:   'APPROVE_REPORTS',
  VIEW_MAINTENANCE:  'VIEW_MAINTENANCE',
  EDIT_MAINTENANCE:  'EDIT_MAINTENANCE',
  VIEW_DEPRECIATION: 'VIEW_DEPRECIATION',
  MANAGE_BRANDS:     'MANAGE_BRANDS',
  MANAGE_SUPPLIERS:  'MANAGE_SUPPLIERS',
  MANAGE_ASSET_TYPES:'MANAGE_ASSET_TYPES',
  MANAGE_ROLES:      'MANAGE_ROLES',
  MANAGE_USERS:      'MANAGE_USERS',
  VIEW_SETTINGS:     'VIEW_SETTINGS',
  EDIT_SETTINGS:     'EDIT_SETTINGS',
  IMPORT_DATA:       'IMPORT_DATA',
  MANAGE_QR:         'MANAGE_QR',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: PermissionKey[] }> = {
  assets: {
    label: 'Assets',
    permissions: [PERMISSIONS.VIEW_ASSETS, PERMISSIONS.EDIT_ASSETS, PERMISSIONS.DELETE_ASSETS],
  },
  inventory: {
    label: 'Inventory',
    permissions: [PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.EDIT_INVENTORY],
  },
  reports: {
    label: 'Reports',
    permissions: [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.APPROVE_REPORTS],
  },
  maintenance: {
    label: 'Maintenance',
    permissions: [PERMISSIONS.VIEW_MAINTENANCE, PERMISSIONS.EDIT_MAINTENANCE],
  },
  depreciation: {
    label: 'Depreciation',
    permissions: [PERMISSIONS.VIEW_DEPRECIATION],
  },
  masters: {
    label: 'Masters',
    permissions: [PERMISSIONS.MANAGE_BRANDS, PERMISSIONS.MANAGE_SUPPLIERS, PERMISSIONS.MANAGE_ASSET_TYPES],
  },
  users: {
    label: 'Users & Roles',
    permissions: [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS],
  },
  system: {
    label: 'System',
    permissions: [PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.IMPORT_DATA, PERMISSIONS.MANAGE_QR],
  },
};

// All permission keys as an array
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);
