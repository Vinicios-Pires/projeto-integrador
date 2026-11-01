import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { arquivoGrandeDemais, BUCKETS } from '../modules/files/files.service';

/**
 * Lê o corpo binário (o próprio arquivo) com o limite de tamanho do bucket. Passar do limite vira
 * `ARQUIVO_GRANDE_DEMAIS` (413). Para as rotas dos módulos que guardam arquivos dos seus registros.
 */
export function lerArquivoDoBucket(bucket: string): RequestHandler {
  const limite = BUCKETS[bucket].maxBytes;
  const leitor = express.raw({ type: () => true, limit: limite });
  return (req: Request, res: Response, next: NextFunction) => {
    leitor(req, res, (err?: unknown) => {
      if ((err as { type?: string } | undefined)?.type === 'entity.too.large') return next(arquivoGrandeDemais(limite));
      next(err);
    });
  };
}
