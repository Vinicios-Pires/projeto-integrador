import { PrismaClient } from '@prisma/client';

/** Instância única do cliente do banco, compartilhada por toda a aplicação. */
export const prisma = new PrismaClient();
