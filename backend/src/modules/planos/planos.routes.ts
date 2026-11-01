import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { planejamentoNaoEncontrado } from '../planejamentos/planejamentos.service';
import { lerArquivoDoBucket } from '../../lib/upload';
import { deleteAnexo, enviarAnexo, listAnexos } from './anexos.service';
import {
  adicionarAulas,
  aprovarPlanos,
  BUCKET_ANEXOS,
  createPlano,
  deletePlano,
  duplicarPlano,
  getPlano,
  listAjustes,
  listPlanos,
  planoNaoEncontrado,
  registrarAjuste,
  updatePlano,
  updatePlanosEmLote,
} from './planos.service';

export const planosRouter = Router();

planosRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw planoNaoEncontrado();
  next();
});
planosRouter.param('planejamentoId', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw planejamentoNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Padrão A: o professor vê e altera os próprios planos; a gestão vê todos (só leitura); o admin
 * pode tudo. Aulas de um planejamento validado não mudam.
 */
planosRouter.get('/planos-aula', requireAuth(), async (req, res) => {
  const q = req.query;
  res.json(
    await listPlanos(req.auth!, {
      planejamento_id: queryString(q.planejamento_id),
      turma_id: queryString(q.turma_id),
      disciplina_id: queryString(q.disciplina_id),
      bimestre: queryString(q.bimestre),
      user_id: queryString(q.user_id),
      status: queryString(q.status),
      data: queryString(q.data),
      de: queryString(q.de),
      ate: queryString(q.ate),
      limite: queryString(q.limite),
    }),
  );
});

planosRouter.post('/planos-aula', requireAuth(), async (req, res) => {
  res.status(201).json(await createPlano(req.auth!, req.body));
});

/** `{ ids, status, comentario? }`: a gestão aprova, devolve para ajuste ou volta a pendente. */
planosRouter.post('/planos-aula/aprovacao', requireAuth(), async (req, res) => {
  res.json(await aprovarPlanos(req.auth!, req.body));
});

/** `{ ids, dados }`: o mesmo valor em várias aulas ("copiar para baixo"). Declarada antes de `/:id`. */
planosRouter.patch('/planos-aula/lote', requireAuth(), async (req, res) => {
  res.json(await updatePlanosEmLote(req.auth!, req.body));
});

planosRouter.get('/planos-aula/:id', requireAuth(), async (req, res) => {
  res.json(await getPlano(req.auth!, req.params.id as string));
});

planosRouter.patch('/planos-aula/:id', requireAuth(), async (req, res) => {
  res.json(await updatePlano(req.auth!, req.params.id as string, req.body));
});

planosRouter.delete('/planos-aula/:id', requireAuth(), async (req, res) => {
  await deletePlano(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** `{ data_aula? }`: padrão, uma semana depois. */
planosRouter.post('/planos-aula/:id/duplicar', requireAuth(), async (req, res) => {
  res.status(201).json(await duplicarPlano(req.auth!, req.params.id as string, req.body));
});

planosRouter.get('/planos-aula/:id/ajustes', requireAuth(), async (req, res) => {
  res.json(await listAjustes(req.auth!, req.params.id as string));
});

/** `{ descricao }`. */
planosRouter.post('/planos-aula/:id/ajustes', requireAuth(), async (req, res) => {
  res.status(201).json(await registrarAjuste(req.auth!, req.params.id as string, req.body));
});

/** `{ datas: [...], numero_aulas? }`: "datas em sequência" dentro do planejamento. */
planosRouter.post('/planejamentos/:planejamentoId/aulas', requireAuth(), async (req, res) => {
  res.status(201).json(await adicionarAulas(req.auth!, req.params.planejamentoId as string, req.body));
});

/** `?tipo=documento|adaptada`. Para abrir: `GET /files/plano-anexos/url?path=<storage_path>`. */
planosRouter.get('/planos-aula/:id/anexos', requireAuth(), async (req, res) => {
  res.json(await listAnexos(req.auth!, req.params.id as string, queryString(req.query.tipo)));
});

/** Corpo: o arquivo. `?tipo=documento|adaptada&nome=<nome original>`. */
planosRouter.post('/planos-aula/:id/anexos', requireAuth(), lerArquivoDoBucket(BUCKET_ANEXOS), async (req, res) => {
  res.status(201).json(
    await enviarAnexo(req.auth!, req.params.id as string, {
      tipo: queryString(req.query.tipo),
      nome: queryString(req.query.nome),
      mime: req.headers['content-type'],
      conteudo: req.body,
    }),
  );
});

planosRouter.delete('/planos-aula/:id/anexos/:anexoId', requireAuth(), async (req, res) => {
  await deleteAnexo(req.auth!, req.params.id as string, req.params.anexoId as string);
  res.status(204).end();
});
