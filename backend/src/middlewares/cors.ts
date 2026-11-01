import type { RequestHandler } from 'express';
import { env } from '../lib/env';

/**
 * Libera o frontend (outro endereço) a chamar a API pelo navegador. Só as origens de
 * `CORS_ORIGINS` recebem os cabeçalhos; as demais são barradas pelo próprio navegador.
 * O login vai no cabeçalho `Authorization` (sem cookies), então não há `credentials`.
 */
export const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && env.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
  }
  next();
};
