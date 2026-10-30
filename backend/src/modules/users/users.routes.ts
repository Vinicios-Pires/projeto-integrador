import { Router, type NextFunction, type Request, type Response } from 'express';
import { isUuid, requiredString } from '../../lib/body';
import { HttpError } from '../../lib/http-error';
import { GESTAO, requireRole } from '../../middlewares/roles';
import { listUsers, resetPassword, setRole, setStatus } from './users.service';

export const usersRouter = Router();

/** `:id` que não é UUID não existe — evita mandar lixo para o banco. */
usersRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isUuid(id)) throw new HttpError(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  next();
});

const queryString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Lista de usuários. A gestão pode ver; só o admin altera (rotas abaixo). */
usersRouter.get('/users', requireRole(...GESTAO), async (req, res) => {
  res.json(await listUsers({ status: queryString(req.query.status), busca: queryString(req.query.busca) }));
});

/** Aprovar / inativar / reativar: `{ status: 'ativo' | 'inativo' }`. */
usersRouter.patch('/users/:id/status', requireRole('admin'), async (req, res) => {
  const status = requiredString(req.body, 'status');
  res.json(await setStatus(req.auth!.user.id, req.params.id as string, status));
});

/** Trocar o papel: `{ role: 'professor' | 'coordenador' | 'direcao' | 'vice_direcao' | 'admin' }`. */
usersRouter.patch('/users/:id/role', requireRole('admin'), async (req, res) => {
  const role = requiredString(req.body, 'role');
  res.json(await setRole(req.auth!.user.id, req.params.id as string, role));
});

/** Resetar a senha: devolve uma senha temporária, exibida só nesta resposta. */
usersRouter.post('/users/:id/reset-password', requireRole('admin'), async (req, res) => {
  res.json(await resetPassword(req.auth!.user.id, req.params.id as string));
});
