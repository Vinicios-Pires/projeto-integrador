import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { app_role } from '@prisma/client';
import { HttpError } from '../lib/http-error';
import { authenticate } from './auth';

/** Equipe gestora — mesma definição de `isGestao` no frontend (inclui o admin). */
export const GESTAO: app_role[] = ['coordenador', 'direcao', 'vice_direcao', 'admin'];

export function isGestao(role: app_role | null | undefined): boolean {
  return !!role && GESTAO.includes(role);
}

/**
 * Exige login **e** um dos papéis informados. O admin tem acesso total e sempre passa.
 *
 *   router.get('/x', requireRole(...GESTAO), handler)   // só gestão
 *   router.patch('/y', requireRole('admin'), handler)    // só admin
 */
export function requireRole(...roles: app_role[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    await authenticate(req);
    const role = req.auth!.role;
    if (role === 'admin' || (role && roles.includes(role))) return next();
    throw new HttpError(403, 'SEM_PERMISSAO', 'Você não tem permissão para fazer isso.');
  };
}
