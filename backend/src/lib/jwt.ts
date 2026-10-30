import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env';

/** O token carrega só o id do usuário; status e papel são relidos do banco a cada requisição. */
export interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Retorna o payload se o token for válido e não expirado; senão, null. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
