import express from 'express';
import { prisma } from './lib/prisma';
import { env } from './lib/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { errorHandler, notFound } from './middlewares/error-handler';

export const app = express();

// Atrás de proxy (Render), para o req.ip — e o limite de tentativas — usar o IP real.
app.set('trust proxy', env.TRUST_PROXY);

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

app.use(authRouter);
app.use(usersRouter);

app.use(notFound);
app.use(errorHandler);
