import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { createProva, deleteProva, getGabarito, getProva, listProvas, provaNaoEncontrada, salvarGabarito, updateProva } from './provas.service';
import { deleteResultado, lancarResultados, listResultados } from './resultados.service';

export const provasRouter = Router();

provasRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw provaNaoEncontrada();
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Padrão A: o professor vê e altera as próprias provas; a gestão vê todas (só leitura); o admin
 * pode tudo.
 */
provasRouter.get('/provas', requireAuth(), async (req, res) => {
  res.json(
    await listProvas(req.auth!, {
      turma_id: queryString(req.query.turma_id),
      disciplina_id: queryString(req.query.disciplina_id),
      bimestre: queryString(req.query.bimestre),
    }),
  );
});

provasRouter.post('/provas', requireAuth(), async (req, res) => {
  res.status(201).json(await createProva(req.auth!, req.body));
});

provasRouter.get('/provas/:id', requireAuth(), async (req, res) => {
  res.json(await getProva(req.auth!, req.params.id as string));
});

provasRouter.patch('/provas/:id', requireAuth(), async (req, res) => {
  res.json(await updateProva(req.auth!, req.params.id as string, req.body));
});

provasRouter.delete('/provas/:id', requireAuth(), async (req, res) => {
  await deleteProva(req.auth!, req.params.id as string);
  res.status(204).end();
});

provasRouter.get('/provas/:id/gabarito', requireAuth(), async (req, res) => {
  res.json(await getGabarito(req.auth!, req.params.id as string));
});

/** `{ questoes: [{ numero_questao, resposta_correta, anulada?, peso? }] }`: o gabarito inteiro. */
provasRouter.put('/provas/:id/gabarito', requireAuth(), async (req, res) => {
  res.json(await salvarGabarito(req.auth!, req.params.id as string, req.body));
});

/** As respostas corrigidas de cada aluno, com o nome e o número de chamada. */
provasRouter.get('/provas/:id/resultados', requireAuth(), async (req, res) => {
  res.json(await listResultados(req.auth!, req.params.id as string));
});

/** `{ resultados: [{ aluno_id, respostas: { "1": "A", ... }, nota?, observacoes? }] }`. */
provasRouter.put('/provas/:id/resultados', requireAuth(), async (req, res) => {
  res.json(await lancarResultados(req.auth!, req.params.id as string, req.body));
});

provasRouter.delete('/provas/:id/resultados/:alunoId', requireAuth(), async (req, res) => {
  await deleteResultado(req.auth!, req.params.id as string, req.params.alunoId as string);
  res.status(204).end();
});
