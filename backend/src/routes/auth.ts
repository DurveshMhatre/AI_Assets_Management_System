import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import '../config/env';
import { securityConfig } from '../config/security';
import { authRateLimiter } from '../middleware/rateLimiter';
import prisma from '../prisma/client';

const router = Router();

// Login
router.post('/login', authRateLimiter, async (req, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { organization: true }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { userId: user.id, role: user.role, orgId: user.organizationId },
            securityConfig.jwtSecret,
            { expiresIn: securityConfig.jwtExpiresIn } as SignOptions
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            securityConfig.jwtRefreshSecret,
            { expiresIn: securityConfig.jwtRefreshExpiresIn } as SignOptions
        );

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

        res.json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organizationId: user.organizationId,
                    organization: user.organization
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Refresh token
router.post('/refresh', async (req, res: Response) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, error: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, securityConfig.jwtRefreshSecret) as any;
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        const accessToken = jwt.sign(
            { userId: user.id, role: user.role, orgId: user.organizationId },
            securityConfig.jwtSecret,
            { expiresIn: securityConfig.jwtExpiresIn } as SignOptions
        );

        res.json({ success: true, data: { accessToken } });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
});

// Logout
router.post('/logout', (_req, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, error: 'No token' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, securityConfig.jwtSecret) as any;

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { organization: true }
        });

        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId,
                organization: user.organization
            }
        });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

export default router;
