import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { createLembrete, deleteLembrete, lembreteNaoEncontrado, listLembretes, updateLembrete } from './lembretes.service';

export const lembretesRouter = Router();

lembretesRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw lembreteNaoEncontrado();
  next();
});

/** Lembretes (post-its): pessoais. Ninguém vê os de outra pessoa, nem a gestão. */
lembretesRouter.get('/lembretes', requireAuth(), async (req, res) => {
  res.json(await listLembretes(req.auth!));
});

lembretesRouter.post('/lembretes', requireAuth(), async (req, res) => {
  res.status(201).json(await createLembrete(req.auth!, req.body));
});

lembretesRouter.patch('/lembretes/:id', requireAuth(), async (req, res) => {
  res.json(await updateLembrete(req.auth!, req.params.id as string, req.body));
});

lembretesRouter.delete('/lembretes/:id', requireAuth(), async (req, res) => {
  await deleteLembrete(req.auth!, req.params.id as string);
  res.status(204).end();
});
