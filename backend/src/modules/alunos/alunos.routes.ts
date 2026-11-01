import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { GESTAO, requireRole } from '../../middlewares/roles';
import {
  alunoNaoEncontrado,
  createAluno,
  deleteAluno,
  getAluno,
  importAlunos,
  listAlunos,
  updateAluno,
} from './alunos.service';

export const alunosRouter = Router();

alunosRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw alunoNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const queryList = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : queryString(value);

/**
 * Padrão C: alunos são um cadastro compartilhado da escola. Qualquer usuário logado lê,
 * cadastra e edita; só a gestão exclui (para tirar alguém da lista, o professor inativa).
 */
alunosRouter.get('/alunos', requireAuth(), async (req, res) => {
  res.json(
    await listAlunos({
      turma_id: queryList(req.query.turma_id),
      ativo: queryString(req.query.ativo),
      ordem: queryString(req.query.ordem),
    }),
  );
});

alunosRouter.get('/alunos/:id', requireAuth(), async (req, res) => {
  res.json(await getAluno(req.params.id as string));
});

/** `{ turma_id, nome, numero_chamada?, serie?, data_nascimento?, email?, telefone?, responsavel?, observacoes?, ativo? }`. */
alunosRouter.post('/alunos', requireAuth(), async (req, res) => {
  res.status(201).json(await createAluno(req.body));
});

/** Importação da planilha: `{ linhas: [{ numero_chamada?, nome, turma }] }`. */
alunosRouter.post('/alunos/importar', requireAuth(), async (req, res) => {
  res.json(await importAlunos(req.auth!, req.body));
});

/** Altera só os campos enviados. */
alunosRouter.patch('/alunos/:id', requireAuth(), async (req, res) => {
  res.json(await updateAluno(req.params.id as string, req.body));
});

alunosRouter.delete('/alunos/:id', requireRole(...GESTAO), async (req, res) => {
  await deleteAluno(req.params.id as string);
  res.status(204).end();
});
