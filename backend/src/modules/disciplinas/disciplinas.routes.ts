import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import {
  createDisciplina,
  deleteDisciplina,
  disciplinaNaoEncontrada,
  getDisciplina,
  listDisciplinas,
  listVinculos,
  setTurmasDaDisciplina,
  updateDisciplina,
} from './disciplinas.service';

export const disciplinasRouter = Router();

disciplinasRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw disciplinaNaoEncontrada();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Padrão A: o professor vê e altera as próprias matérias (e os vínculos delas com turmas);
 * a gestão vê todas (só leitura); o admin pode tudo. Matéria de outro professor responde 404.
 */
disciplinasRouter.get('/disciplinas', requireAuth(), async (req, res) => {
  res.json(await listDisciplinas(req.auth!));
});

disciplinasRouter.get('/disciplinas/:id', requireAuth(), async (req, res) => {
  res.json(await getDisciplina(req.auth!, req.params.id as string));
});

/** `{ nome, cor?, professor?, carga_horaria? }`. O dono é quem cria. */
disciplinasRouter.post('/disciplinas', requireAuth(), async (req, res) => {
  res.status(201).json(await createDisciplina(req.auth!, req.body));
});

/** Altera só os campos enviados. */
disciplinasRouter.patch('/disciplinas/:id', requireAuth(), async (req, res) => {
  res.json(await updateDisciplina(req.auth!, req.params.id as string, req.body));
});

disciplinasRouter.delete('/disciplinas/:id', requireAuth(), async (req, res) => {
  await deleteDisciplina(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** `{ turma_ids: [...] }`: substitui as turmas em que a matéria aparece. */
disciplinasRouter.put('/disciplinas/:id/turmas', requireAuth(), async (req, res) => {
  res.json(await setTurmasDaDisciplina(req.auth!, req.params.id as string, req.body));
});

/** Vínculos matéria ↔ turma, com filtros opcionais `turma_id`, `disciplina_id` e `user_id`. */
disciplinasRouter.get('/turma-disciplinas', requireAuth(), async (req, res) => {
  res.json(
    await listVinculos(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      user_id: queryString(req.query.user_id),
    }),
  );
});
