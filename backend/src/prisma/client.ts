import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatasourceUrl(): string | undefined {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;
    // Strip accidental quotes or spaces
    url = url.replace(/^["']|["']$/g, '').trim();
    if (!url.includes('connection_limit=')) {
        url += (url.includes('?') ? '&' : '?') + 'connection_limit=5';
    }
    return url;
}

const dbUrl = getDatasourceUrl();

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;
