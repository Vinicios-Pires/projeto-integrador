import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { deleteExcecao, deleteRotina, itemNaoEncontrado, listExcecoes, listRotina, salvarExcecoes, salvarRotina } from './agenda.service';

export const agendaRouter = Router();

agendaRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw itemNaoEncontrado();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Agenda do professor: cada um grava a própria; a gestão pode ver a de um professor com
 * `?user_id=`; o admin pode limpar itens de qualquer um.
 */
agendaRouter.get('/agenda/rotina', requireAuth(), async (req, res) => {
  res.json(await listRotina(req.auth!, queryString(req.query.user_id)));
});

/** `{ itens: [{ dia_semana, horario_grade_id, turma_id?, disciplina_id?, atividade?, cor? }] }`. */
agendaRouter.put('/agenda/rotina', requireAuth(), async (req, res) => {
  res.json(await salvarRotina(req.auth!, req.body));
});

agendaRouter.delete('/agenda/rotina/:id', requireAuth(), async (req, res) => {
  await deleteRotina(req.auth!, req.params.id as string);
  res.status(204).end();
});

/** `?de=&ate=&user_id=`. */
agendaRouter.get('/agenda/excecoes', requireAuth(), async (req, res) => {
  res.json(
    await listExcecoes(req.auth!, { user_id: queryString(req.query.user_id), de: queryString(req.query.de), ate: queryString(req.query.ate) }),
  );
});

/** `{ itens: [{ data, horario_grade_id, turma_id?, disciplina_id?, atividade?, cancelado?, observacao? }] }`. */
agendaRouter.put('/agenda/excecoes', requireAuth(), async (req, res) => {
  res.json(await salvarExcecoes(req.auth!, req.body));
});

agendaRouter.delete('/agenda/excecoes/:id', requireAuth(), async (req, res) => {
  await deleteExcecao(req.auth!, req.params.id as string);
  res.status(204).end();
});
