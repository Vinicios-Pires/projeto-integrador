import express from 'express';
import { prisma } from './lib/prisma';

export const app = express();

app.use(express.json());

/** Verificação de vida do serviço e da conexão com o banco (usada também pelo Render). */
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
});
