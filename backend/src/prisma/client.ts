import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatasourceUrl(): string | undefined {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;
    // Strip accidental quotes or spaces
    url = url.replace(/^["']|["']$/g, '').trim();

    // Supabase transaction pooler (port 6543) requires pgbouncer=true for Prisma
    if (url.includes(':6543') && !url.includes('pgbouncer=true')) {
        url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }

    if (!url.includes('connection_limit=')) {
        url += (url.includes('?') ? '&' : '?') + 'connection_limit=10';
    }

    if (!url.includes('pool_timeout=')) {
        url += (url.includes('?') ? '&' : '?') + 'pool_timeout=20';
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
