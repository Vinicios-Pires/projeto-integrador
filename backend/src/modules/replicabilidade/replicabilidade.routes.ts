import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { lerArquivoDoBucket } from '../../lib/upload';
import { requireAuth } from '../../middlewares/auth';
import {
  BUCKET_FOTOS,
  createReplicabilidade,
  deleteFoto,
  deleteReplicabilidade,
  enviarFoto,
  getReplicabilidade,
  listReplicabilidades,
  registroNaoEncontrado,
  updateReplicabilidade,
} from './replicabilidade.service';

export const replicabilidadeRouter = Router();

replicabilidadeRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw registroNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Mural de boas práticas (padrão D): todo usuário logado vê tudo. Professores e admin publicam;
 * quem publicou (ou o admin) altera e exclui. As fotos abrem por `/files/replicabilidade-fotos/url`.
 */
replicabilidadeRouter.get('/replicabilidades', requireAuth(), async (req, res) => {
  res.json(await listReplicabilidades({ user_id: queryString(req.query.user_id) }));
});

replicabilidadeRouter.post('/replicabilidades', requireAuth(), async (req, res) => {
  res.status(201).json(await createReplicabilidade(req.auth!, req.body));
});

replicabilidadeRouter.get('/replicabilidades/:id', requireAuth(), async (req, res) => {
  res.json(await getReplicabilidade(req.params.id as string));
});

replicabilidadeRouter.patch('/replicabilidades/:id', requireAuth(), async (req, res) => {
  res.json(await updateReplicabilidade(req.auth!, req.params.id as string, req.body));
});

replicabilidadeRouter.delete('/replicabilidades/:id', requireAuth(), async (req, res) => {
  await deleteReplicabilidade(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Corpo: a foto (até 10 MB). `?nome=`. */
replicabilidadeRouter.post('/replicabilidades/:id/fotos', requireAuth(), lerArquivoDoBucket(BUCKET_FOTOS), async (req, res) => {
  res.status(201).json(
    await enviarFoto(req.auth!, req.params.id as string, { nome: queryString(req.query.nome), mime: req.headers['content-type'], conteudo: req.body }),
  );
});

replicabilidadeRouter.delete('/replicabilidades/:id/fotos/:fotoId', requireAuth(), async (req, res) => {
  await deleteFoto(req.auth!, req.params.id as string, req.params.fotoId as string);
  res.status(204).end();
});
