import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { PERMISSIONS } from '../constants/permissions';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// Ensure uploads directory exists (Render uses ephemeral filesystem)
const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const manualStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `user-manual-${Date.now()}${path.extname(file.originalname)}`)
});

const manualUpload = multer({
    storage: manualStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.pdf', '.doc', '.docx'].includes(ext)) cb(null, true);
        else cb(new Error('Only PDF or Word documents are allowed'));
    }
});

router.get('/', checkPermission(PERMISSIONS.VIEW_SETTINGS), async (req: AuthRequest, res: Response) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
        if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
        res.json({ success: true, data: { ...org, settings: JSON.parse(org.settings || '{}') } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.put('/', checkPermission(PERMISSIONS.EDIT_SETTINGS), async (req: AuthRequest, res: Response) => {
    try {
        const { name, address, settings } = req.body;
        const updateData: any = {};
        if (name) updateData.name = name;
        if (address) updateData.address = address;
        if (settings) updateData.settings = JSON.stringify(settings);

        const org = await prisma.organization.update({
            where: { id: req.user!.organizationId },
            data: updateData
        });
        res.json({ success: true, data: { ...org, settings: JSON.parse(org.settings || '{}') } });
    } catch (error) { res.status(500).json({ success: false, error: 'Server error' }); }
});

router.post('/manual', checkPermission(PERMISSIONS.EDIT_SETTINGS), manualUpload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
        if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

        const existingSettings = JSON.parse(org.settings || '{}');
        const userManualPath = `/uploads/${req.file.filename}`;
        const newSettings = { ...existingSettings, userManualPath };

        const updated = await prisma.organization.update({
            where: { id: org.id },
            data: { settings: JSON.stringify(newSettings) }
        });

        res.json({
            success: true,
            data: { ...updated, settings: newSettings }
        });
    } catch (error: any) {
        const message = error?.message || 'Upload failed';
        res.status(500).json({ success: false, error: message });
    }
});

// ── Branches (for dropdowns across the app) ──────────────────────────────
router.get('/branches', async (req: AuthRequest, res: Response) => {
    try {
        const branches = await prisma.branch.findMany({
            where: { organizationId: req.user!.organizationId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, city: true, pincode: true },
        });
        res.json({ success: true, data: branches });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
