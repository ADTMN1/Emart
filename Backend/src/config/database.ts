import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
    },
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

globalThis.prisma = prisma;

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM', 'beforeExit'] as const;
SHUTDOWN_SIGNALS.forEach((signal) => {
  process.on(signal, async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* noop on shutdown */
    }
  });
});

export default prisma;
