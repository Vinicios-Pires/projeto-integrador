import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { GESTAO, requireRole } from '../../middlewares/roles';
import {
  apoioNaoEncontrado,
  createApoio,
  createEvento,
  deleteApoio,
  deleteEvento,
  eventoNaoEncontrado,
  listApoios,
  listEventos,
  updateApoio,
  updateEvento,
} from './escola.service';

export const escolaRouter = Router();

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const idDe = (naoEncontrado: () => Error) => (req: Request, _res: Response, next: NextFunction) => {
  if (!isUuid(req.params.id as string)) throw naoEncontrado();
  next();
};

/** Eventos da escola: todos veem; a gestão cria, altera e exclui (a permissão vem antes do id). */
escolaRouter.get('/eventos-escola', requireAuth(), async (req, res) => {
  res.json(await listEventos({ de: queryString(req.query.de), ate: queryString(req.query.ate), tipo: queryString(req.query.tipo) }));
});

escolaRouter.post('/eventos-escola', requireAuth(), requireRole(...GESTAO), async (req, res) => {
  res.status(201).json(await createEvento(req.auth!, req.body));
});

escolaRouter.patch('/eventos-escola/:id', requireAuth(), requireRole(...GESTAO), idDe(eventoNaoEncontrado), async (req, res) => {
  res.json(await updateEvento(req.params.id as string, req.body));
});

escolaRouter.delete('/eventos-escola/:id', requireAuth(), requireRole(...GESTAO), idDe(eventoNaoEncontrado), async (req, res) => {
  await deleteEvento(req.params.id as string);
  res.status(204).end();
});

/** Apoio presencial: a gestão vê todos e mantém; o professor vê os seus. */
escolaRouter.get('/apoio-presencial', requireAuth(), async (req, res) => {
  res.json(
    await listApoios(req.auth!, { de: queryString(req.query.de), ate: queryString(req.query.ate), professor_id: queryString(req.query.professor_id) }),
  );
});

escolaRouter.post('/apoio-presencial', requireAuth(), requireRole(...GESTAO), async (req, res) => {
  res.status(201).json(await createApoio(req.auth!, req.body));
});

escolaRouter.patch('/apoio-presencial/:id', requireAuth(), requireRole(...GESTAO), idDe(apoioNaoEncontrado), async (req, res) => {
  res.json(await updateApoio(req.params.id as string, req.body));
});

escolaRouter.delete('/apoio-presencial/:id', requireAuth(), requireRole(...GESTAO), idDe(apoioNaoEncontrado), async (req, res) => {
  await deleteApoio(req.params.id as string);
  res.status(204).end();
});
