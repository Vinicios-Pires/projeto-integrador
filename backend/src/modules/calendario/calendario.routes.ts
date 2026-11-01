import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/roles';
import type { HttpError } from '../../lib/http-error';
import {
  anoNaoEncontrado,
  createAno,
  createHorario,
  deleteAno,
  deleteHorario,
  horarioNaoEncontrado,
  listAnos,
  listHorarios,
  updateAno,
  updateHorario,
} from './calendario.service';

export const calendarioRouter = Router();

/** `:id` que não é UUID não existe. Cada rota diz qual 404 responder. */
const idValido = (naoEncontrado: () => HttpError) => (req: Request, _res: Response, next: NextFunction) => {
  if (!isUuid(req.params.id as string)) throw naoEncontrado();
  next();
};

/** Padrão C: cadastro da escola. Todo usuário logado lê; só o admin altera. */
calendarioRouter.get('/horario-grade', requireAuth(), async (_req, res) => {
  res.json(await listHorarios());
});

/** `{ ordem, rotulo, hora_inicio: 'HH:MM', hora_fim: 'HH:MM', tipo? }`. */
calendarioRouter.post('/horario-grade', requireRole('admin'), async (req, res) => {
  res.status(201).json(await createHorario(req.body));
});

calendarioRouter.patch('/horario-grade/:id', requireRole('admin'), idValido(horarioNaoEncontrado), async (req, res) => {
  res.json(await updateHorario(req.params.id as string, req.body));
});

calendarioRouter.delete('/horario-grade/:id', requireRole('admin'), idValido(horarioNaoEncontrado), async (req, res) => {
  await deleteHorario(req.params.id as string);
  res.status(204).end();
});

calendarioRouter.get('/ano-letivo', requireAuth(), async (_req, res) => {
  res.json(await listAnos());
});

/** `{ ano, data_inicio: 'AAAA-MM-DD', data_fim: 'AAAA-MM-DD', ativo? }`. */
calendarioRouter.post('/ano-letivo', requireRole('admin'), async (req, res) => {
  res.status(201).json(await createAno(req.body));
});

calendarioRouter.patch('/ano-letivo/:id', requireRole('admin'), idValido(anoNaoEncontrado), async (req, res) => {
  res.json(await updateAno(req.params.id as string, req.body));
});

calendarioRouter.delete('/ano-letivo/:id', requireRole('admin'), idValido(anoNaoEncontrado), async (req, res) => {
  await deleteAno(req.params.id as string);
  res.status(204).end();
});
