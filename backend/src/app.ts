import express from 'express';
import { prisma } from './lib/prisma';
import { env } from './lib/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { turmasRouter } from './modules/turmas/turmas.routes';
import { alunosRouter } from './modules/alunos/alunos.routes';
import { disciplinasRouter } from './modules/disciplinas/disciplinas.routes';
import { calendarioRouter } from './modules/calendario/calendario.routes';
import { filesRouter } from './modules/files/files.routes';
import { avaliacoesRouter } from './modules/avaliacoes/avaliacoes.routes';
import { provasRouter } from './modules/provas/provas.routes';
import { planejamentosRouter } from './modules/planejamentos/planejamentos.routes';
import { planosRouter } from './modules/planos/planos.routes';
import { errorHandler, notFound } from './middlewares/error-handler';

export const app = express();

// Atrás de proxy (Render), para o req.ip — e o limite de tentativas — usar o IP real.
app.set('trust proxy', env.TRUST_PROXY);

// 1 MB cabe a importação da planilha de alunos (até 2000 linhas).
app.use(express.json({ limit: '1mb' }));

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
app.use(turmasRouter);
app.use(alunosRouter);
app.use(disciplinasRouter);
app.use(calendarioRouter);
app.use(filesRouter);
app.use(avaliacoesRouter);
app.use(provasRouter);
app.use(planejamentosRouter);
app.use(planosRouter);

app.use(notFound);
app.use(errorHandler);
