import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error';

/** Rota inexistente. */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: 'Rota não encontrada.' } });
}

/**
 * Converte qualquer erro em `{ error: { code, message } }`. Erros inesperados viram
 * 500 genérico, sem vazar detalhes internos para quem chamou.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // JSON malformado no corpo da requisição (lançado pelo express.json()).
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'DADOS_INVALIDOS', message: 'Corpo da requisição inválido.' } });
    return;
  }

  // Corpo acima do limite do express.json().
  if ((err as { type?: string })?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'CORPO_GRANDE_DEMAIS', message: 'Dados enviados grandes demais.' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Erro interno. Tente novamente.' } });
}
