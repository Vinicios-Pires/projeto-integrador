import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { armazenamentoLocal } from '../../lib/storage';
import { env } from '../../lib/env';
import {
  arquivoGrandeDemais,
  arquivoNaoEncontrado,
  BUCKETS,
  enviarArquivo,
  excluirArquivo,
  excluirArquivos,
  linkArquivo,
  linksArquivos,
  regraDoBucket,
} from './files.service';

export const filesRouter = Router();

/** Endereço da própria API, para montar os links (atrás do Render, vale o `trust proxy`). */
const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

/**
 * Link temporário do disco local (o equivalente à URL assinada do Supabase): abre sem login,
 * até expirar. Só existe com `STORAGE_DRIVER=local`; no Supabase, o link aponta para lá.
 */
if (env.STORAGE_DRIVER === 'local') {
  const local = armazenamentoLocal();
  filesRouter.get('/files/link/:token', async (req, res) => {
    const arquivo = await local.ler(req.params.token as string);
    if (!arquivo) throw arquivoNaoEncontrado();
    res.setHeader('Content-Type', arquivo.mime);
    // O navegador respeita o tipo guardado e não tenta "adivinhar" (evita rodar algo disfarçado).
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader(
      'Content-Disposition',
      arquivo.download ? `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.download)}` : 'inline',
    );
    res.send(arquivo.conteudo);
  });
}

filesRouter.param('bucket', (_req: Request, _res: Response, next: NextFunction, bucket: string) => {
  regraDoBucket(bucket);
  next();
});

/** Um leitor de corpo binário por bucket, cada um com o limite de tamanho dele. */
const leitores = Object.fromEntries(
  Object.entries(BUCKETS).map(([bucket, regra]) => [bucket, express.raw({ type: () => true, limit: regra.maxBytes })]),
);
function lerArquivo(req: Request, res: Response, next: NextFunction) {
  const regra = regraDoBucket(req.params.bucket as string);
  leitores[req.params.bucket as string](req, res, (err?: unknown) => {
    if ((err as { type?: string } | undefined)?.type === 'entity.too.large') return next(arquivoGrandeDemais(regra.maxBytes));
    next(err);
  });
}

const query = (req: Request, nome: string) => (typeof req.query[nome] === 'string' ? req.query[nome] : undefined);

/**
 * Enviar: o corpo é o próprio arquivo (como `fetch(url, { body: file })`), com o tipo no
 * `Content-Type`. `?pasta=<id do registro>&nome=<nome original>`. O login é conferido antes
 * de ler o arquivo.
 */
filesRouter.post('/files/:bucket', requireAuth(), lerArquivo, async (req, res) => {
  res.status(201).json(
    await enviarArquivo(req.auth!, req.params.bucket as string, {
      pasta: query(req, 'pasta'),
      nome: query(req, 'nome'),
      mime: req.headers['content-type'],
      conteudo: req.body,
    }),
  );
});

/** Link temporário: `?path=...&segundos=3600&download=<nome para baixar>`. */
filesRouter.get('/files/:bucket/url', requireAuth(), async (req, res) => {
  res.json(
    await linkArquivo(
      req.auth!,
      req.params.bucket as string,
      { path: query(req, 'path'), download: query(req, 'download'), segundos: query(req, 'segundos') },
      baseUrl(req),
    ),
  );
});

/** Vários links: `{ paths: [...], segundos? }`. */
filesRouter.post('/files/:bucket/urls', requireAuth(), async (req, res) => {
  res.json(await linksArquivos(req.auth!, req.params.bucket as string, req.body, baseUrl(req)));
});

/** Excluir um: `?path=...`. */
filesRouter.delete('/files/:bucket', requireAuth(), async (req, res) => {
  await excluirArquivo(req.auth!, req.params.bucket as string, query(req, 'path'));
  res.status(204).end();
});

/** Excluir vários: `{ paths: [...] }`. */
filesRouter.post('/files/:bucket/excluir', requireAuth(), async (req, res) => {
  res.json(await excluirArquivos(req.auth!, req.params.bucket as string, req.body));
});
