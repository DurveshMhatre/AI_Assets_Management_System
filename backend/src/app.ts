import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import assetRoutes from './routes/assets';
import importRoutes from './routes/import';
import inventoryRoutes from './routes/inventory';
import maintenanceRoutes from './routes/maintenance';
import depreciationRoutes from './routes/depreciation';
import reportRoutes from './routes/reports';
import brandRoutes from './routes/brands';
import supplierRoutes from './routes/suppliers';
import assetTypeRoutes from './routes/assetTypes';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import settingsRoutes from './routes/settings';
import auditLogRoutes from './routes/auditLogs';
import qrRoutes from './routes/qrRoutes';
import unitReportRoutes from './routes/unitReports';
import extensionRoutes from './routes/extensions';
import tenderRoutes from './routes/tenders';
import tenderTypeRoutes from './routes/tenderTypes';
import prisma from './prisma/client';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Middleware - CORS must be BEFORE helmet
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim().replace(/\/$/, '')); // remove trailing slashes

console.log('Allowed CORS origins:', allowedOrigins);

const corsOptions = {
    origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS for all routes
app.options('*', cors(corsOptions));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/import', importRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/depreciation', depreciationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/asset-types', assetTypeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/unit-reports', unitReportRoutes);
app.use('/api/templates', importRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/tender-types', tenderTypeRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err: any) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});
// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 AMS Backend running on http://localhost:${PORT}`);
});

export default app;
