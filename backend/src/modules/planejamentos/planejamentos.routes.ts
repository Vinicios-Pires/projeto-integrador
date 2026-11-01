import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import {
  abrirPlanejamento,
  deletePlanejamento,
  getPlanejamento,
  listPlanejamentos,
  mudarStatus,
  planejamentoNaoEncontrado,
} from './planejamentos.service';

export const planejamentosRouter = Router();

planejamentosRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw planejamentoNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Padrão A para ver (o professor vê os seus; a gestão, todos) e padrão E para a situação: o dono
 * envia para validação; a gestão valida, pede ajustes ou reabre.
 */
planejamentosRouter.get('/planejamentos', requireAuth(), async (req, res) => {
  res.json(
    await listPlanejamentos(req.auth!, {
      bimestre: queryString(req.query.bimestre),
      ano: queryString(req.query.ano),
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      user_id: queryString(req.query.user_id),
    }),
  );
});

/** Abre o planejamento: devolve o que já existe (200) ou cria um rascunho (201). */
planejamentosRouter.post('/planejamentos', requireAuth(), async (req, res) => {
  const { criado, planejamento } = await abrirPlanejamento(req.auth!, req.body);
  res.status(criado ? 201 : 200).json(planejamento);
});

planejamentosRouter.get('/planejamentos/:id', requireAuth(), async (req, res) => {
  res.json(await getPlanejamento(req.auth!, req.params.id as string));
});

/** `{ status, observacao? }`. */
planejamentosRouter.post('/planejamentos/:id/status', requireAuth(), async (req, res) => {
  res.json(await mudarStatus(req.auth!, req.params.id as string, req.body));
});

planejamentosRouter.delete('/planejamentos/:id', requireAuth(), async (req, res) => {
  await deletePlanejamento(req.auth!, req.params.id as string);
  res.status(204).end();
});
