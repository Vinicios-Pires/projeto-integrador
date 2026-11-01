import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import {
  createTipo,
  deleteTipo,
  lancarNotas,
  listNotas,
  listTipos,
  reordenarTipos,
  tipoNaoEncontrado,
  updateTipo,
} from './avaliacoes.service';
import { descartarMedias, listMedias, salvarMedias } from './medias.service';

export const avaliacoesRouter = Router();

avaliacoesRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw tipoNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const queryList = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : queryString(value);

/**
 * Padrão A: o professor vê e altera as próprias avaliações e notas; a gestão vê todas (só
 * leitura); o admin pode tudo.
 */
avaliacoesRouter.get('/tipos-avaliacao', requireAuth(), async (req, res) => {
  res.json(
    await listTipos(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      bimestre: queryString(req.query.bimestre),
    }),
  );
});

avaliacoesRouter.post('/tipos-avaliacao', requireAuth(), async (req, res) => {
  res.status(201).json(await createTipo(req.auth!, req.body));
});

/** `{ ids: [...] }`: nova ordem das colunas. Declarada antes de `/:id`. */
avaliacoesRouter.put('/tipos-avaliacao/ordem', requireAuth(), async (req, res) => {
  res.json(await reordenarTipos(req.auth!, req.body));
});

avaliacoesRouter.patch('/tipos-avaliacao/:id', requireAuth(), async (req, res) => {
  res.json(await updateTipo(req.auth!, req.params.id as string, req.body));
});

avaliacoesRouter.delete('/tipos-avaliacao/:id', requireAuth(), async (req, res) => {
  await deleteTipo(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Filtros: `aluno_id`, `tipo_avaliacao_id` (um ou vários), `bimestre`, `turma_id`, `disciplina_id`. */
avaliacoesRouter.get('/notas', requireAuth(), async (req, res) => {
  res.json(
    await listNotas(req.auth!, {
      aluno_id: queryList(req.query.aluno_id),
      tipo_avaliacao_id: queryList(req.query.tipo_avaliacao_id),
      bimestre: queryString(req.query.bimestre),
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
    }),
  );
});

/** `{ notas: [{ aluno_id, tipo_avaliacao_id, nota | null, observacoes? }] }`. */
avaliacoesRouter.put('/notas', requireAuth(), async (req, res) => {
  res.json(await lancarNotas(req.auth!, req.body));
});

/** Médias ajustadas à mão. Filtros: `turma_id`, `disciplina_id`, `bimestre`, `aluno_id` (um ou vários). */
avaliacoesRouter.get('/medias-arredondadas', requireAuth(), async (req, res) => {
  res.json(
    await listMedias(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      bimestre: queryString(req.query.bimestre),
      aluno_id: queryList(req.query.aluno_id),
    }),
  );
});

/** `{ turma_id, disciplina_id, bimestre, medias: [{ aluno_id, nota_arredondada | null, manual? }] }`. */
avaliacoesRouter.put('/medias-arredondadas', requireAuth(), async (req, res) => {
  res.json(await salvarMedias(req.auth!, req.body));
});

/** `{ turma_id, disciplina_id, bimestre, aluno_ids? }`: volta ao cálculo automático. */
avaliacoesRouter.post('/medias-arredondadas/descartar', requireAuth(), async (req, res) => {
  res.json(await descartarMedias(req.auth!, req.body));
});
