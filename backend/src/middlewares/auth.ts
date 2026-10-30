import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';
import { HttpError } from '../lib/http-error';
import { assertActive, loadSessionUser, type SessionUser } from '../modules/auth/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Preenchido por `requireAuth` — usuário dono do token. */
      auth?: SessionUser;
    }
  }
}

interface RequireAuthOptions {
  /**
   * Libera a rota mesmo com senha temporária pendente de troca. Só para as rotas
   * que o usuário precisa justamente para trocá-la (`/me` e `/auth/change-password`).
   */
  allowTempPassword?: boolean;
}

/**
 * Confere o token (`Authorization: Bearer <token>`) e preenche `req.auth`. Status e papel
 * são relidos do banco a cada requisição, então inativar alguém corta o acesso na hora,
 * sem esperar o token expirar.
 */
export async function authenticate(req: Request, { allowTempPassword = false }: RequireAuthOptions = {}) {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  const payload = scheme === 'Bearer' && token ? verifyToken(token) : null;
  if (!payload) {
    throw new HttpError(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
  }

  const session = await loadSessionUser(payload.sub);
  if (!session) {
    throw new HttpError(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
  }
  assertActive(session);
  if (session.deve_trocar_senha && !allowTempPassword) {
    throw new HttpError(403, 'SENHA_TEMPORARIA', 'Troque sua senha temporária para continuar.');
  }

  req.auth = session;
}

/** Middleware que exige login (ver `authenticate`). */
export function requireAuth(options: RequireAuthOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    await authenticate(req, options);
    next();
  };
}
