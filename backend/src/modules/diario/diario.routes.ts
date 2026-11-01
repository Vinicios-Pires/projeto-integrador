import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import {
  atividadeNaoEncontrada,
  createAtividade,
  deleteAtividade,
  lancar,
  listAtividades,
  listLancamentos,
  listObservacoes,
  reordenarAtividades,
  salvarObservacao,
  updateAtividade,
} from './diario.service';

export const diarioRouter = Router();

diarioRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw atividadeNaoEncontrada();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const queryList = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : queryString(value);

/**
 * Diário de classe. Padrão A: o professor vê e altera o próprio diário; a gestão vê todos (só
 * leitura); o admin pode tudo.
 */
diarioRouter.get('/diario/atividades', requireAuth(), async (req, res) => {
  res.json(
    await listAtividades(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      bimestre: queryString(req.query.bimestre),
    }),
  );
});

diarioRouter.post('/diario/atividades', requireAuth(), async (req, res) => {
  res.status(201).json(await createAtividade(req.auth!, req.body));
});

/** `{ ids: [...] }`: nova ordem das colunas. Declarada antes de `/:id`. */
diarioRouter.put('/diario/atividades/ordem', requireAuth(), async (req, res) => {
  res.json(await reordenarAtividades(req.auth!, req.body));
});

diarioRouter.patch('/diario/atividades/:id', requireAuth(), async (req, res) => {
  res.json(await updateAtividade(req.auth!, req.params.id as string, req.body));
});

diarioRouter.delete('/diario/atividades/:id', requireAuth(), async (req, res) => {
  await deleteAtividade(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Filtros: `atividade_id` e `aluno_id` (um ou vários). */
diarioRouter.get('/diario/lancamentos', requireAuth(), async (req, res) => {
  res.json(await listLancamentos(req.auth!, { atividade_id: queryList(req.query.atividade_id), aluno_id: queryList(req.query.aluno_id) }));
});

/** `{ lancamentos: [{ atividade_id, aluno_id, valor, fez?, observacao? }] }`. */
diarioRouter.put('/diario/lancamentos', requireAuth(), async (req, res) => {
  res.json(await lancar(req.auth!, req.body));
});

/** Filtros: `turma_id`, `disciplina_id`, `bimestre`, `aluno_id` (um ou vários). */
diarioRouter.get('/diario/observacoes', requireAuth(), async (req, res) => {
  res.json(
    await listObservacoes(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      bimestre: queryString(req.query.bimestre),
      aluno_id: queryList(req.query.aluno_id),
    }),
  );
});

/** `{ aluno_id, turma_id, disciplina_id?, bimestre, observacao }`. Vazio apaga (204). */
diarioRouter.put('/diario/observacoes', requireAuth(), async (req, res) => {
  const obs = await salvarObservacao(req.auth!, req.body);
  if (obs) res.json(obs);
  else res.status(204).end();
});
