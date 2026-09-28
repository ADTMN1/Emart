import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import config from '../src/config/env';

/**
 * Create or restore the admin account WITHOUT touching any other seed data.
 *
 * Unlike `prisma seed` (which also re-creates the demo products and is not
 * idempotent), this upserts a single admin user by email and forcibly resets
 * its role, password and suspension state to the values in `.env`, so a lost
 * or changed admin password is always recoverable:
 *
 *   npm run prisma:restore-admin
 */
const prisma = new PrismaClient();

async function main() {
  const email = config.admin.email.trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(config.admin.password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      suspended: false,
    },
    create: {
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  await prisma.cart.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  console.log('✅ Admin account ready:', admin.email);
  console.log('   Password: ' + (process.env.ADMIN_PASSWORD ? 'restored from .env' : config.admin.password));
}

main()
  .catch((e) => {
    console.error('❌ Restore failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });