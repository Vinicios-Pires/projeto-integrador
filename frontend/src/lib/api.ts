/**
 * Cliente do backend próprio (painelescolar-api). Substitui o `supabase-js`:
 * todas as telas falam com a API por aqui, com o token do login no cabeçalho.
 */

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/$/, '');

const CHAVE_TOKEN = 'painel.token';

/** Erro devolvido pela API: `{ error: { code, message } }`. A mensagem já vem em português. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// localStorage pode estar bloqueado (aba anônima, política do navegador): sem ele, o login vale só na aba.
let tokenEmMemoria: string | null = null;

export const token = {
  get(): string | null {
    try {
      return localStorage.getItem(CHAVE_TOKEN) ?? tokenEmMemoria;
    } catch {
      return tokenEmMemoria;
    }
  },
  set(valor: string) {
    tokenEmMemoria = valor;
    try {
      localStorage.setItem(CHAVE_TOKEN, valor);
    } catch {
      /* fica só em memória */
    }
  },
  clear() {
    tokenEmMemoria = null;
    try {
      localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* nada a limpar */
    }
  },
};

let aoExpirar: (() => void) | null = null;

/** Chamado quando a API recusa o token (expirou, conta inativada): o AuthContext volta para o login. */
export function aoPerderLogin(fn: (() => void) | null) {
  aoExpirar = fn;
}

type Valor = string | number | boolean | null | undefined;

export interface Opcoes {
  /** Corpo: objeto vira JSON; `Blob`/`File` vai cru (envio de arquivo). */
  body?: unknown;
  /** Filtros da URL; `undefined`, `null` e `''` ficam de fora. */
  query?: Record<string, Valor | Valor[]>;
  signal?: AbortSignal;
}

function montarUrl(caminho: string, query?: Opcoes['query']) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(query ?? {})) {
    const valores = Array.isArray(valor) ? valor : [valor];
    for (const v of valores) if (v !== undefined && v !== null && v !== '') params.append(chave, String(v));
  }
  const qs = params.toString();
  return `${API_URL}${caminho}${qs ? `?${qs}` : ''}`;
}

export async function request<T = unknown>(metodo: string, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const atual = token.get();
  if (atual) headers.Authorization = `Bearer ${atual}`;

  let body: BodyInit | undefined;
  if (opcoes.body instanceof Blob) {
    body = opcoes.body;
    headers['Content-Type'] = opcoes.body.type || 'application/octet-stream';
  } else if (opcoes.body !== undefined) {
    body = JSON.stringify(opcoes.body);
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(montarUrl(caminho, opcoes.query), { method: metodo, headers, body, signal: opcoes.signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Verifique a internet e tente de novo.');
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);

  if (!res.ok) {
    const erro = dados?.error ?? {};
    if (res.status === 401 && atual) {
      token.clear();
      aoExpirar?.();
    }
    throw new ApiError(res.status, erro.code ?? 'ERRO', erro.message ?? `Erro ${res.status}. Tente novamente.`);
  }
  return dados as T;
}

export const api = {
  get: <T = unknown>(caminho: string, query?: Opcoes['query'], signal?: AbortSignal) =>
    request<T>('GET', caminho, { query, signal }),
  post: <T = unknown>(caminho: string, body?: unknown, query?: Opcoes['query']) =>
    request<T>('POST', caminho, { body, query }),
  put: <T = unknown>(caminho: string, body?: unknown, query?: Opcoes['query']) =>
    request<T>('PUT', caminho, { body, query }),
  patch: <T = unknown>(caminho: string, body?: unknown) => request<T>('PATCH', caminho, { body }),
  delete: <T = unknown>(caminho: string, query?: Opcoes['query']) => request<T>('DELETE', caminho, { query }),
};

/** Mensagem para mostrar ao usuário a partir de qualquer erro. */
export function mensagemDeErro(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.';
}

/**
 * Busca por uma lista grande de ids em lotes (o backend aceita até 500 por filtro, e a URL tem limite),
 * juntando os resultados. Os ids vão separados por vírgula.
 */
export async function buscarEmLotes<T>(ids: string[], buscar: (lote: string) => Promise<T[]>, tamanho = 150): Promise<T[]> {
  const lotes: string[] = [];
  for (let i = 0; i < ids.length; i += tamanho) lotes.push(ids.slice(i, i + tamanho).join(','));
  return (await Promise.all(lotes.map(buscar))).flat();
}

/** Link temporário de um arquivo do correio de arquivos (`GET /files/:bucket/url`). */
export async function linkDoArquivo(bucket: string, path: string, segundos = 3600): Promise<string> {
  return (await api.get<{ url: string }>(`/files/${bucket}/url`, { path, segundos })).url;
}

/**
 * Linha "solta", para as telas que ainda tratam os dados sem tipo (como faziam com o Supabase).
 * Um só lugar com `any`, em vez de um em cada chamada.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LinhaSolta = Record<string, any>;

/** Links temporários de vários arquivos de um bucket (`POST /files/:bucket/urls`, até 200 por pedido): caminho → link. */
export async function linksDosArquivos(bucket: string, paths: string[], segundos = 3600): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 200) {
    const lote = await api.post<{ path: string; url: string | null }[]>(`/files/${bucket}/urls`, { paths: paths.slice(i, i + 200), segundos });
    lote.forEach(l => { if (l.url) links.set(l.path, l.url); });
  }
  return links;
}
