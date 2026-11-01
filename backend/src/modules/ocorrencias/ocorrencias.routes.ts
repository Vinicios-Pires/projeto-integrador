import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { lerArquivoDoBucket } from '../../lib/upload';
import {
  BUCKET_FOTOS,
  createEscolar,
  createNotebook,
  deleteEscolar,
  deleteFoto,
  deleteNotebook,
  enviarFoto,
  getEscolar,
  getNotebook,
  listEscolares,
  listNotebook,
  marcarVista,
  ocorrenciaNaoEncontrada,
  responderEscolar,
  updateEscolar,
  updateNotebook,
} from './ocorrencias.service';

export const ocorrenciasRouter = Router();

ocorrenciasRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw ocorrenciaNaoEncontrada();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

// ----- Ocorrências do notebook (padrão A) -----

ocorrenciasRouter.get('/ocorrencias-notebook', requireAuth(), async (req, res) => {
  res.json(await listNotebook(req.auth!, { turma_id: queryString(req.query.turma_id), de: queryString(req.query.de), ate: queryString(req.query.ate) }));
});

ocorrenciasRouter.post('/ocorrencias-notebook', requireAuth(), async (req, res) => {
  res.status(201).json(await createNotebook(req.auth!, req.body));
});

ocorrenciasRouter.get('/ocorrencias-notebook/:id', requireAuth(), async (req, res) => {
  res.json(await getNotebook(req.auth!, req.params.id as string));
});

ocorrenciasRouter.patch('/ocorrencias-notebook/:id', requireAuth(), async (req, res) => {
  res.json(await updateNotebook(req.auth!, req.params.id as string, req.body));
});

ocorrenciasRouter.delete('/ocorrencias-notebook/:id', requireAuth(), async (req, res) => {
  await deleteNotebook(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Corpo: a foto, com o `Content-Type`. `?nome=<nome original>`. */
ocorrenciasRouter.post('/ocorrencias-notebook/:id/fotos', requireAuth(), lerArquivoDoBucket(BUCKET_FOTOS), async (req, res) => {
  res.status(201).json(
    await enviarFoto(req.auth!, req.params.id as string, { nome: queryString(req.query.nome), mime: req.headers['content-type'], conteudo: req.body }),
  );
});

ocorrenciasRouter.delete('/ocorrencias-notebook/:id/fotos/:fotoId', requireAuth(), async (req, res) => {
  await deleteFoto(req.auth!, req.params.id as string, req.params.fotoId as string);
  res.status(204).end();
});

// ----- Ocorrências escolares (o professor registra, a gestão responde) -----

ocorrenciasRouter.get('/ocorrencias-escolares', requireAuth(), async (req, res) => {
  const q = req.query;
  res.json(
    await listEscolares(req.auth!, {
      status: queryString(q.status),
      tipo: queryString(q.tipo),
      user_id: queryString(q.user_id),
      aluno: queryString(q.aluno),
      de: queryString(q.de),
      ate: queryString(q.ate),
    }),
  );
});

ocorrenciasRouter.post('/ocorrencias-escolares', requireAuth(), async (req, res) => {
  res.status(201).json(await createEscolar(req.auth!, req.body));
});

ocorrenciasRouter.get('/ocorrencias-escolares/:id', requireAuth(), async (req, res) => {
  res.json(await getEscolar(req.auth!, req.params.id as string));
});

ocorrenciasRouter.patch('/ocorrencias-escolares/:id', requireAuth(), async (req, res) => {
  res.json(await updateEscolar(req.auth!, req.params.id as string, req.body));
});

/** `{ status, providencias? }`. Só a gestão. */
ocorrenciasRouter.post('/ocorrencias-escolares/:id/resposta', requireAuth(), async (req, res) => {
  res.json(await responderEscolar(req.auth!, req.params.id as string, req.body));
});

ocorrenciasRouter.post('/ocorrencias-escolares/:id/visto', requireAuth(), async (req, res) => {
  res.json(await marcarVista(req.auth!, req.params.id as string));
});

ocorrenciasRouter.delete('/ocorrencias-escolares/:id', requireAuth(), async (req, res) => {
  await deleteEscolar(req.auth!, req.params.id as string);
  res.status(204).end();
});
