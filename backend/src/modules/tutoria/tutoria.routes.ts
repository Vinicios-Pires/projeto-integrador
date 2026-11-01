import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { lerArquivoDoBucket } from '../../lib/upload';
import { requireAuth } from '../../middlewares/auth';
import {
  addCheckin,
  addCombinado,
  addRegistro,
  BUCKET_DOCUMENTOS,
  BUCKET_FOTOS,
  createTutorado,
  deleteItem,
  deleteTutorado,
  enviarDocumento,
  getTutorado,
  ITENS,
  type Item,
  listRegistros,
  listTutorados,
  removerFoto,
  trocarFoto,
  tutoradoNaoEncontrado,
  updateCombinado,
  updateTutorado,
  vincularAlunos,
} from './tutoria.service';

export const tutoriaRouter = Router();

tutoriaRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw tutoradoNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const queryList = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : queryString(value);
const envio = (req: Request) => ({ nome: queryString(req.query.nome), mime: req.headers['content-type'], conteudo: req.body });

/**
 * Tutoria. Padrão A sobre o tutorado: o tutor vê e altera; a gestão vê todos (só leitura); o admin
 * pode tudo. O acompanhamento (check-ins, registros, combinados, documentos) segue o tutorado.
 */
tutoriaRouter.get('/tutorados', requireAuth(), async (req, res) => {
  res.json(await listTutorados(req.auth!, { status: queryString(req.query.status), user_id: queryString(req.query.user_id) }));
});

tutoriaRouter.post('/tutorados', requireAuth(), async (req, res) => {
  res.status(201).json(await createTutorado(req.auth!, req.body));
});

/** `{ aluno_ids }`: vincula vários alunos. Declarada antes de `/:id`. */
tutoriaRouter.post('/tutorados/vincular', requireAuth(), async (req, res) => {
  res.status(201).json(await vincularAlunos(req.auth!, req.body));
});

/** Os registros de vários tutorados (`?tutorado_id=a,b`). */
tutoriaRouter.get('/tutoria-registros', requireAuth(), async (req, res) => {
  res.json(await listRegistros(req.auth!, { tutorado_id: queryList(req.query.tutorado_id) }));
});

tutoriaRouter.get('/tutorados/:id', requireAuth(), async (req, res) => {
  res.json(await getTutorado(req.auth!, req.params.id as string));
});

tutoriaRouter.patch('/tutorados/:id', requireAuth(), async (req, res) => {
  res.json(await updateTutorado(req.auth!, req.params.id as string, req.body));
});

tutoriaRouter.delete('/tutorados/:id', requireAuth(), async (req, res) => {
  await deleteTutorado(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** Corpo: a foto (até 10 MB). Troca a anterior. */
tutoriaRouter.put('/tutorados/:id/foto', requireAuth(), lerArquivoDoBucket(BUCKET_FOTOS), async (req, res) => {
  res.json(await trocarFoto(req.auth!, req.params.id as string, envio(req)));
});

tutoriaRouter.delete('/tutorados/:id/foto', requireAuth(), async (req, res) => {
  res.json(await removerFoto(req.auth!, req.params.id as string));
});

tutoriaRouter.post('/tutorados/:id/checkins', requireAuth(), async (req, res) => {
  res.status(201).json(await addCheckin(req.auth!, req.params.id as string, req.body));
});

tutoriaRouter.post('/tutorados/:id/registros', requireAuth(), async (req, res) => {
  res.status(201).json(await addRegistro(req.auth!, req.params.id as string, req.body));
});

tutoriaRouter.post('/tutorados/:id/combinados', requireAuth(), async (req, res) => {
  res.status(201).json(await addCombinado(req.auth!, req.params.id as string, req.body));
});

tutoriaRouter.patch('/tutorados/:id/combinados/:itemId', requireAuth(), async (req, res) => {
  res.json(await updateCombinado(req.auth!, req.params.id as string, req.params.itemId as string, req.body));
});

/** Corpo: o documento (até 20 MB). `?nome=`. */
tutoriaRouter.post('/tutorados/:id/documentos', requireAuth(), lerArquivoDoBucket(BUCKET_DOCUMENTOS), async (req, res) => {
  res.status(201).json(await enviarDocumento(req.auth!, req.params.id as string, envio(req)));
});

/** Apaga um check-in, registro, combinado ou documento. */
tutoriaRouter.delete('/tutorados/:id/:item/:itemId', requireAuth(), async (req, res, next) => {
  const item = req.params.item as string;
  if (!(ITENS as readonly string[]).includes(item)) return next();
  await deleteItem(req.auth!, req.params.id as string, item as Item, req.params.itemId as string);
  res.status(204).end();
});
