import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import {
  createTurma,
  deleteTurma,
  getTurma,
  listMembros,
  listTurmas,
  setMembros,
  turmaNaoEncontrada,
  updateTurma,
} from './turmas.service';

export const turmasRouter = Router();

turmasRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw turmaNaoEncontrada();
  next();
});

/**
 * Padrão A: o professor vê e altera as próprias turmas; a gestão vê todas (só leitura);
 * o admin pode tudo. Turma de outro professor responde 404, como se não existisse.
 */
turmasRouter.get('/turmas', requireAuth(), async (req, res) => {
  res.json(await listTurmas(req.auth!));
});

turmasRouter.get('/turmas/:id', requireAuth(), async (req, res) => {
  res.json(await getTurma(req.auth!, req.params.id as string));
});

/** `{ nome, serie, turno?, ano_letivo?, capacidade?, observacoes?, tipo? }`. O dono é quem cria. */
turmasRouter.post('/turmas', requireAuth(), async (req, res) => {
  res.status(201).json(await createTurma(req.auth!, req.body));
});

/** Altera só os campos enviados. */
turmasRouter.patch('/turmas/:id', requireAuth(), async (req, res) => {
  res.json(await updateTurma(req.auth!, req.params.id as string, req.body));
});

turmasRouter.delete('/turmas/:id', requireAuth(), async (req, res) => {
  await deleteTurma(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Membros da eletiva, cada um com o aluno e a turma de origem dele. Filtro opcional `ativo`. */
turmasRouter.get('/turmas/:id/membros', requireAuth(), async (req, res) => {
  const ativo = typeof req.query.ativo === 'string' ? req.query.ativo : undefined;
  res.json(await listMembros(req.auth!, req.params.id as string, ativo));
});

/** `{ aluno_ids: [...] }`: substitui os membros da eletiva. Dono e admin. */
turmasRouter.put('/turmas/:id/membros', requireAuth(), async (req, res) => {
  res.json(await setMembros(req.auth!, req.params.id as string, req.body));
});
