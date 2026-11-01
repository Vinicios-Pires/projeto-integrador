import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { lerArquivoDoBucket } from '../../lib/upload';
import { requireAuth } from '../../middlewares/auth';
import {
  BUCKET_DOCUMENTOS,
  BUCKET_FOTOS,
  createEvidencia,
  deleteDocumento,
  deleteEvidencia,
  deleteFoto,
  enviarDocumento,
  enviarFoto,
  evidenciaNaoEncontrada,
  getEvidencia,
  listEvidencias,
  updateEvidencia,
} from './pdi.service';

export const pdiRouter = Router();

pdiRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw evidenciaNaoEncontrada();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * PDI. Padrão A: o professor vê e altera as próprias evidências; a gestão vê todas (só leitura);
 * o admin pode tudo. Cada evidência vem com `fotos` e `documentos`; os links saem de `/files/...`.
 */
pdiRouter.get('/pdi-evidencias', requireAuth(), async (req, res) => {
  const q = req.query;
  res.json(
    await listEvidencias(req.auth!, {
      turma_id: queryString(q.turma_id),
      disciplina_id: queryString(q.disciplina_id),
      bimestre: queryString(q.bimestre),
      ano_letivo: queryString(q.ano_letivo),
      tipo_atividade: queryString(q.tipo_atividade),
      user_id: queryString(q.user_id),
    }),
  );
});

pdiRouter.post('/pdi-evidencias', requireAuth(), async (req, res) => {
  res.status(201).json(await createEvidencia(req.auth!, req.body));
});

pdiRouter.get('/pdi-evidencias/:id', requireAuth(), async (req, res) => {
  res.json(await getEvidencia(req.auth!, req.params.id as string));
});

pdiRouter.patch('/pdi-evidencias/:id', requireAuth(), async (req, res) => {
  res.json(await updateEvidencia(req.auth!, req.params.id as string, req.body));
});

pdiRouter.delete('/pdi-evidencias/:id', requireAuth(), async (req, res) => {
  await deleteEvidencia(req.auth!, req.params.id as string);
  res.status(204).end();
});

const envio = (req: Request) => ({ nome: queryString(req.query.nome), mime: req.headers['content-type'], conteudo: req.body });

/** Corpo: a foto (até 10 MB). `?nome=`. */
pdiRouter.post('/pdi-evidencias/:id/fotos', requireAuth(), lerArquivoDoBucket(BUCKET_FOTOS), async (req, res) => {
  res.status(201).json(await enviarFoto(req.auth!, req.params.id as string, envio(req)));
});

pdiRouter.delete('/pdi-evidencias/:id/fotos/:fotoId', requireAuth(), async (req, res) => {
  await deleteFoto(req.auth!, req.params.id as string, req.params.fotoId as string);
  res.status(204).end();
});

/** Corpo: o documento (até 20 MB). `?nome=`. */
pdiRouter.post('/pdi-evidencias/:id/documentos', requireAuth(), lerArquivoDoBucket(BUCKET_DOCUMENTOS), async (req, res) => {
  res.status(201).json(await enviarDocumento(req.auth!, req.params.id as string, envio(req)));
});

pdiRouter.delete('/pdi-evidencias/:id/documentos/:docId', requireAuth(), async (req, res) => {
  await deleteDocumento(req.auth!, req.params.id as string, req.params.docId as string);
  res.status(204).end();
});
