import { randomBytes } from 'node:crypto';
import { HttpError } from '../../lib/http-error';
import { env } from '../../lib/env';
import { isUuid } from '../../lib/body';
import { isGestao } from '../../middlewares/roles';
import { armazenamentoLocal, type Armazenamento } from '../../lib/storage';
import { armazenamentoSupabase } from '../../lib/storage-supabase';
import type { SessionUser } from '../auth/auth.service';

const MB = 1024 * 1024;
const IMAGENS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const DOCUMENTOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain',
  'text/csv',
];

interface RegraBucket {
  /** Tipos de arquivo aceitos no envio. */
  tipos: string[];
  maxBytes: number;
  /** Mural público (padrão D): qualquer usuário logado abre. Nos outros, só o dono e a gestão. */
  leituraLivre?: boolean;
}

/** Os 7 buckets do sistema atual, com os tipos que cada tela aceita (`accept` dos campos). */
export const BUCKETS: Record<string, RegraBucket> = {
  'ocorrencias-fotos': { tipos: IMAGENS, maxBytes: 10 * MB },
  'plano-anexos': { tipos: [...DOCUMENTOS, ...IMAGENS], maxBytes: 20 * MB },
  'pdi-fotos': { tipos: IMAGENS, maxBytes: 10 * MB },
  'pdi-documentos': { tipos: DOCUMENTOS, maxBytes: 20 * MB },
  'replicabilidade-fotos': { tipos: IMAGENS, maxBytes: 10 * MB, leituraLivre: true },
  'tutoria-fotos': { tipos: IMAGENS, maxBytes: 10 * MB },
  'tutoria-documentos': { tipos: [...DOCUMENTOS, ...IMAGENS], maxBytes: 20 * MB },
};
export const MAX_BYTES = Math.max(...Object.values(BUCKETS).map((b) => b.maxBytes));

function escolherArmazenamento(): Armazenamento {
  if (env.STORAGE_DRIVER === 'local') return armazenamentoLocal();
  return armazenamentoSupabase({ url: env.SUPABASE_URL!, chave: env.SUPABASE_SERVICE_ROLE_KEY! });
}
export const armazenamento = escolherArmazenamento();

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const arquivoNaoEncontrado = () => new HttpError(404, 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo não encontrado.');
export const bucketNaoEncontrado = () => new HttpError(404, 'BUCKET_NAO_ENCONTRADO', 'Tipo de arquivo (bucket) inexistente.');

export function regraDoBucket(bucket: string): RegraBucket {
  const regra = Object.hasOwn(BUCKETS, bucket) ? BUCKETS[bucket] : undefined;
  if (!regra) throw bucketNaoEncontrado();
  return regra;
}

/**
 * Confere um caminho recebido e devolve o dono, que é sempre a primeira pasta
 * (`<dono>/...`, a mesma convenção das regras do Supabase). Recusa `..`, pastas vazias e
 * caracteres de controle, para ninguém escapar da pasta do bucket.
 */
function donoDoCaminho(caminho: unknown): string {
  if (typeof caminho !== 'string' || !caminho || caminho.length > 500) throw invalido('Informe o caminho ("path") do arquivo.');
  const partes = caminho.split('/');
  // eslint-disable-next-line no-control-regex
  if (partes.length < 2 || partes.some((p) => !p || p === '.' || p === '..' || /[\\\u0000-\u001f]/.test(p))) {
    throw invalido('Caminho de arquivo inválido.');
  }
  if (!isUuid(partes[0])) throw invalido('Caminho de arquivo inválido.');
  return partes[0];
}

/** Ler: o dono e a gestão (no mural, qualquer usuário logado). Quem não pode, nem sabe que existe. */
function assertLeitura(auth: SessionUser, bucket: string, caminho: unknown): string {
  const dono = donoDoCaminho(caminho);
  if (!regraDoBucket(bucket).leituraLivre && dono !== auth.user.id && !isGestao(auth.role)) throw arquivoNaoEncontrado();
  return caminho as string;
}

/** Excluir: o dono e o admin. A gestão, que só vê, recebe "sem permissão". */
function assertExclusao(auth: SessionUser, bucket: string, caminho: unknown): string {
  assertLeitura(auth, bucket, caminho);
  if (donoDoCaminho(caminho) !== auth.user.id && auth.role !== 'admin') {
    throw new HttpError(403, 'SEM_PERMISSAO', 'Só quem enviou o arquivo pode excluí-lo.');
  }
  return caminho as string;
}

function listaDeCaminhos(body: unknown, max: number): unknown[] {
  const paths = (body as { paths?: unknown } | undefined)?.paths;
  if (!Array.isArray(paths) || paths.length === 0) throw invalido('Envie "paths" com pelo menos um caminho.');
  if (paths.length > max) throw invalido(`No máximo ${max} arquivos por vez.`);
  return [...new Set(paths)];
}

/** Nome seguro para o caminho: sem acentos, espaços nem símbolos (o nome original volta na resposta). */
function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '');
  return limpo.slice(-100) || 'arquivo';
}

export interface ArquivoEnviado {
  bucket: string;
  path: string;
  nome: string;
  mime_type: string;
  tamanho_bytes: number;
}

/**
 * Guarda o arquivo sempre na pasta de quem envia: `<usuário>/<pasta>/<data>-<sorteio>-<nome>`.
 * `pasta` é o registro dono do arquivo (ocorrência, plano, evidência…). O caminho devolvido é o
 * que a tela grava no banco, como hoje. Os módulos que já conferiram a permissão podem guardar na
 * pasta do dono do registro (`dono`), para o professor ver o que o admin enviou por ele.
 */
export async function enviarArquivo(
  auth: SessionUser,
  bucket: string,
  dados: { pasta: unknown; nome: unknown; mime: string | undefined; conteudo: unknown },
  dono: string = auth.user.id,
): Promise<ArquivoEnviado> {
  const regra = regraDoBucket(bucket);
  if (typeof dados.pasta !== 'string' || !/^[\w-]{1,100}$/.test(dados.pasta)) {
    throw invalido('Informe a "pasta" (o id do registro dono do arquivo): letras, números, "-" ou "_".');
  }
  const nome = typeof dados.nome === 'string' && dados.nome.trim() ? dados.nome.trim().slice(0, 255) : 'arquivo';
  const mime = dados.mime?.split(';')[0].trim().toLowerCase() ?? '';
  if (!regra.tipos.includes(mime)) {
    throw new HttpError(415, 'TIPO_NAO_PERMITIDO', `Tipo de arquivo não aceito aqui (${mime || 'sem tipo'}).`);
  }
  if (!Buffer.isBuffer(dados.conteudo) || dados.conteudo.length === 0) {
    throw new HttpError(400, 'ARQUIVO_VAZIO', 'O arquivo enviado está vazio.');
  }
  if (dados.conteudo.length > regra.maxBytes) throw arquivoGrandeDemais(regra.maxBytes);

  const caminho = `${dono}/${dados.pasta}/${Date.now()}-${randomBytes(4).toString('hex')}-${nomeSeguro(nome)}`;
  await armazenamento.salvar(bucket, caminho, dados.conteudo, mime);
  return { bucket, path: caminho, nome, mime_type: mime, tamanho_bytes: dados.conteudo.length };
}

export const arquivoGrandeDemais = (maxBytes: number) =>
  new HttpError(413, 'ARQUIVO_GRANDE_DEMAIS', `O arquivo passa do limite de ${maxBytes / MB} MB.`);

function lerSegundos(valor: unknown): number {
  if (valor === undefined) return 3600;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 10 || n > 86400) throw invalido('"segundos" deve ser um inteiro entre 10 e 86400.');
  return n;
}

export interface LinkArquivo {
  path: string;
  url: string | null;
  expira_em: string;
}

const expiraEm = (segundos: number) => new Date(Date.now() + segundos * 1000).toISOString();

/** Link temporário para um arquivo (substitui o `createSignedUrl` do Supabase). */
export async function linkArquivo(
  auth: SessionUser,
  bucket: string,
  consulta: { path: unknown; download: unknown; segundos: unknown },
  base: string,
): Promise<LinkArquivo> {
  const caminho = assertLeitura(auth, bucket, consulta.path);
  const segundos = lerSegundos(consulta.segundos);
  const download = typeof consulta.download === 'string' && consulta.download ? consulta.download.slice(0, 255) : undefined;
  const [url] = await armazenamento.links(bucket, [caminho], { segundos, download, base });
  if (!url) throw arquivoNaoEncontrado();
  return { path: caminho, url, expira_em: expiraEm(segundos) };
}

export const MAX_LINKS = 200;

/**
 * Vários links de uma vez (substitui o `createSignedUrls`). Se algum caminho não puder ser
 * aberto por quem pediu, nenhum link é gerado. Arquivo que não existe volta com `url: null`.
 */
export async function linksArquivos(auth: SessionUser, bucket: string, body: unknown, base: string): Promise<LinkArquivo[]> {
  const caminhos = listaDeCaminhos(body, MAX_LINKS).map((c) => assertLeitura(auth, bucket, c));
  const segundos = lerSegundos((body as { segundos?: unknown }).segundos);
  const urls = await armazenamento.links(bucket, caminhos, { segundos, base });
  return caminhos.map((path, i) => ({ path, url: urls[i], expira_em: expiraEm(segundos) }));
}

export async function excluirArquivo(auth: SessionUser, bucket: string, path: unknown): Promise<void> {
  const caminho = assertExclusao(auth, bucket, path);
  if ((await armazenamento.excluir(bucket, [caminho])).length === 0) throw arquivoNaoEncontrado();
}

/** Exclui vários (ex.: todas as fotos de uma ocorrência). Ou pode excluir todos, ou nenhum sai. */
export async function excluirArquivos(auth: SessionUser, bucket: string, body: unknown): Promise<{ excluidos: string[] }> {
  const caminhos = listaDeCaminhos(body, MAX_LINKS).map((c) => assertExclusao(auth, bucket, c));
  return { excluidos: await armazenamento.excluir(bucket, caminhos) };
}
