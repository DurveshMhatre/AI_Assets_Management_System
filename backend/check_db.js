const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'admin@demo.com' } });
        console.log(user ? 'User exists: ' + user.email : 'User does not exist in the database!');
    } catch (e) {
        console.error('Error connecting to database:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
