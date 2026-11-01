import type { Prisma, tutoria_documentos, tutorados } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { listaDeIds } from '../avaliacoes/avaliacoes.service';
import { armazenamento, enviarArquivo } from '../files/files.service';

// ===== Tutoria: os alunos tutorados de cada professor e o acompanhamento de cada um =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const tutoradoNaoEncontrado = () => new HttpError(404, 'TUTORADO_NAO_ENCONTRADO', 'Tutorado não encontrado.');
const itemNaoEncontrado = () => new HttpError(404, 'ITEM_NAO_ENCONTRADO', 'Item da tutoria não encontrado.');
export const BUCKET_FOTOS = 'tutoria-fotos';
export const BUCKET_DOCUMENTOS = 'tutoria-documentos';

export const STATUS_TUTORADO = ['ativo', 'inativo'];
/** O humor do check-in (os botões da tela). */
export const HUMORES = ['bem', 'mais_ou_menos', 'dificil', 'observar'];
export const STATUS_COMBINADO = ['pendente', 'concluido'];

const dia = (d: Date) => d.toISOString().slice(0, 10);
type ComData<T extends { data: Date }> = Omit<T, 'data'> & { data: string };
const comDia = <T extends { data: Date }>(r: T): ComData<T> => ({ ...r, data: dia(r.data) });

export type TutoradoRow = Omit<tutorados, 'data_inicio'> & { data_inicio: string };
const toTutorado = (t: tutorados): TutoradoRow => ({ ...t, data_inicio: dia(t.data_inicio) });
type DocumentoRow = Omit<tutoria_documentos, 'tamanho_bytes'> & { tamanho_bytes: number | null };
const toDocumento = (d: tutoria_documentos): DocumentoRow => ({ ...d, tamanho_bytes: d.tamanho_bytes === null ? null : Number(d.tamanho_bytes) });

async function buscarTutorado(auth: SessionUser, id: string) {
  const t = await prisma.tutorados.findUnique({ where: { id } });
  if (!t || !podeLer(auth, t.user_id)) throw tutoradoNaoEncontrado();
  return t;
}

async function buscarEditavel(auth: SessionUser, id: string) {
  const t = await prisma.tutorados.findUnique({ where: { id } });
  if (!t) throw tutoradoNaoEncontrado();
  exigirEscrita(auth, t.user_id, tutoradoNaoEncontrado, 'Só o professor tutor pode alterar a tutoria deste aluno.');
  return t;
}

// ----- Tutorados -----

/** Padrão A. Filtros: situação e tutor. Em ordem de nome. */
export async function listTutorados(auth: SessionUser, f: { status?: string; user_id?: string }): Promise<TutoradoRow[]> {
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  if (f.status !== undefined && !STATUS_TUTORADO.includes(f.status)) throw invalido('"status" inválido.');
  const lista = await prisma.tutorados.findMany({
    where: { AND: [filtroLeitura(auth), user_id ? { user_id } : {}], ...(f.status ? { status: f.status } : {}) },
    orderBy: { nome: 'asc' },
  });
  return lista.map(toTutorado);
}

/** O tutorado com todo o acompanhamento (a tela de detalhe). */
export async function getTutorado(auth: SessionUser, id: string) {
  await buscarTutorado(auth, id);
  const t = await prisma.tutorados.findUniqueOrThrow({
    where: { id },
    include: {
      checkins: { orderBy: { created_at: 'desc' } },
      registros: { orderBy: [{ data: 'desc' }, { created_at: 'desc' }] },
      combinados: { orderBy: [{ data: 'desc' }, { created_at: 'desc' }] },
      documentos: { orderBy: { created_at: 'desc' } },
    },
  });
  const { checkins, registros, combinados, documentos, ...tutorado } = t;
  return {
    ...toTutorado(tutorado),
    checkins,
    registros: registros.map(comDia),
    combinados: combinados.map(comDia),
    documentos: documentos.map(toDocumento),
  };
}

function lerTutorado(body: unknown, parcial: boolean) {
  const data_inicio = optionalDate(body, 'data_inicio');
  if (data_inicio === null) throw invalido('O campo "data_inicio" não pode ficar vazio.');
  return {
    nome: requiredText(body, 'nome', parcial),
    turma: optionalString(body, 'turma'),
    numero_chamada: optionalInt(body, 'numero_chamada', 0, 999),
    status: optionalChoice(body, 'status', STATUS_TUTORADO),
    observacoes: optionalString(body, 'observacoes'),
    data_inicio,
  };
}

/** `{ nome, aluno_id?, turma?, numero_chamada?, status?, observacoes?, data_inicio? }`. O tutor é quem cria. */
export async function createTutorado(auth: SessionUser, body: unknown): Promise<TutoradoRow> {
  const dados = lerTutorado(body, false);
  const aluno_id = optionalString(body, 'aluno_id');
  if (aluno_id) {
    if (!isUuid(aluno_id) || !(await prisma.alunos.findUnique({ where: { id: aluno_id } }))) throw new HttpError(400, 'ALUNO_INVALIDO', 'O aluno não existe.');
    if (await prisma.tutorados.findFirst({ where: { user_id: auth.user.id, aluno_id } })) {
      throw new HttpError(409, 'TUTORADO_DUPLICADO', 'Este aluno já é seu tutorado.');
    }
  }
  return toTutorado(await prisma.tutorados.create({ data: { ...dados, nome: dados.nome!, aluno_id: aluno_id ?? null, user_id: auth.user.id } }));
}

/**
 * `{ aluno_ids: [...] }`: vincula vários alunos de uma vez (nome, turma e número de chamada vêm do
 * cadastro do aluno). Os que já são tutorados de quem pede ficam de fora, sem erro.
 */
export async function vincularAlunos(auth: SessionUser, body: unknown): Promise<{ criados: TutoradoRow[]; ja_existiam: number }> {
  const ids = (body as { aluno_ids?: unknown } | undefined)?.aluno_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || !isUuid(i)) || new Set(ids).size !== ids.length) {
    throw invalido('Envie "aluno_ids" com os alunos, sem repetir.');
  }
  if (ids.length > 200) throw invalido('No máximo 200 alunos por vez.');
  const alunos = await prisma.alunos.findMany({ where: { id: { in: ids as string[] } }, include: { turma: { select: { nome: true } } } });
  if (alunos.length !== ids.length) throw new HttpError(400, 'ALUNO_INVALIDO', 'Um dos alunos informados não existe.');
  const existentes = new Set(
    (await prisma.tutorados.findMany({ where: { user_id: auth.user.id, aluno_id: { in: ids as string[] } }, select: { aluno_id: true } })).map((t) => t.aluno_id),
  );
  const novos = alunos.filter((a) => !existentes.has(a.id));
  const criados = await prisma.tutorados.createManyAndReturn({
    data: novos.map((a) => ({
      user_id: auth.user.id,
      aluno_id: a.id,
      nome: a.nome,
      turma: a.turma?.nome ?? a.serie ?? null,
      numero_chamada: a.numero_chamada,
      status: 'ativo',
    })),
  });
  return { criados: criados.map(toTutorado), ja_existiam: existentes.size };
}

export async function updateTutorado(auth: SessionUser, id: string, body: unknown): Promise<TutoradoRow> {
  const dados = lerTutorado(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarEditavel(auth, id);
  return toTutorado(await prisma.tutorados.update({ where: { id }, data: dados }));
}

/** Todo o acompanhamento sai junto, inclusive a foto e os documentos no armazenamento. */
export async function deleteTutorado(auth: SessionUser, id: string): Promise<void> {
  const t = await buscarEditavel(auth, id);
  const docs = await prisma.tutoria_documentos.findMany({ where: { tutorado_id: id }, select: { storage_path: true } });
  await prisma.tutorados.delete({ where: { id } });
  if (t.foto_path) await armazenamento.excluir(BUCKET_FOTOS, [t.foto_path]);
  if (docs.length) await armazenamento.excluir(BUCKET_DOCUMENTOS, docs.map((d) => d.storage_path));
}

type Envio = { nome: unknown; mime: string | undefined; conteudo: unknown };

/** Troca a foto do tutorado (a anterior é apagada). Fica na pasta do tutor. */
export async function trocarFoto(auth: SessionUser, id: string, dados: Envio): Promise<TutoradoRow> {
  const t = await buscarEditavel(auth, id);
  const arquivo = await enviarArquivo(auth, BUCKET_FOTOS, { pasta: t.id, ...dados }, t.user_id);
  try {
    const atualizado = await prisma.tutorados.update({ where: { id }, data: { foto_path: arquivo.path } });
    if (t.foto_path) await armazenamento.excluir(BUCKET_FOTOS, [t.foto_path]).catch(() => undefined);
    return toTutorado(atualizado);
  } catch (err) {
    await armazenamento.excluir(BUCKET_FOTOS, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

export async function removerFoto(auth: SessionUser, id: string): Promise<TutoradoRow> {
  const t = await buscarEditavel(auth, id);
  if (!t.foto_path) throw new HttpError(404, 'ARQUIVO_NAO_ENCONTRADO', 'O tutorado não tem foto.');
  const atualizado = await prisma.tutorados.update({ where: { id }, data: { foto_path: null } });
  await armazenamento.excluir(BUCKET_FOTOS, [t.foto_path]);
  return toTutorado(atualizado);
}

// ----- Acompanhamento: check-ins, registros, combinados e documentos -----

/** Os registros de vários tutorados de uma vez (a lista mostra o último de cada um). */
export async function listRegistros(auth: SessionUser, f: { tutorado_id?: string | string[] }) {
  const tutorados = listaDeIds(f.tutorado_id, 'tutorado_id');
  const lista = await prisma.tutoria_registros.findMany({
    where: { ...filtroLeitura(auth), ...(tutorados.length ? { tutorado_id: { in: tutorados } } : {}) },
    orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
  });
  return lista.map(comDia);
}

/** `{ humor, observacao? }`. */
export async function addCheckin(auth: SessionUser, id: string, body: unknown) {
  const t = await buscarEditavel(auth, id);
  const humor = optionalChoice(body, 'humor', HUMORES);
  if (!humor) throw invalido(`"humor" deve ser ${HUMORES.join(', ')}.`);
  return prisma.tutoria_checkins.create({ data: { tutorado_id: id, user_id: t.user_id, humor, observacao: optionalString(body, 'observacao') } });
}

/** `{ como_esta, observacao?, combinado?, proxima_acao?, data? }`. */
export async function addRegistro(auth: SessionUser, id: string, body: unknown) {
  const t = await buscarEditavel(auth, id);
  const data = optionalDate(body, 'data') ?? undefined;
  const registro = await prisma.tutoria_registros.create({
    data: {
      tutorado_id: id,
      user_id: t.user_id,
      como_esta: requiredText(body, 'como_esta'),
      observacao: optionalString(body, 'observacao'),
      combinado: optionalString(body, 'combinado'),
      proxima_acao: optionalString(body, 'proxima_acao'),
      ...(data ? { data } : {}),
    },
  });
  return comDia(registro);
}

/** `{ descricao, data? }`. Nasce pendente. */
export async function addCombinado(auth: SessionUser, id: string, body: unknown) {
  const t = await buscarEditavel(auth, id);
  const data = optionalDate(body, 'data') ?? undefined;
  const combinado = await prisma.tutoria_combinados.create({
    data: { tutorado_id: id, user_id: t.user_id, descricao: requiredText(body, 'descricao')!, status: 'pendente', ...(data ? { data } : {}) },
  });
  return comDia(combinado);
}

/** `{ status?, descricao? }`: marcar como cumprido (ou voltar a pendente). */
export async function updateCombinado(auth: SessionUser, id: string, combinadoId: string, body: unknown) {
  await buscarEditavel(auth, id);
  const status = optionalChoice(body, 'status', STATUS_COMBINADO);
  const descricao = requiredText(body, 'descricao', true);
  if (status === undefined && descricao === undefined) throw invalido('Informe pelo menos um campo para alterar.');
  const { count } = await prisma.tutoria_combinados.updateMany({
    where: { id: isUuid(combinadoId) ? combinadoId : '00000000-0000-0000-0000-000000000000', tutorado_id: id },
    data: { ...(status ? { status } : {}), ...(descricao ? { descricao } : {}) },
  });
  if (!count) throw itemNaoEncontrado();
  return comDia(await prisma.tutoria_combinados.findUniqueOrThrow({ where: { id: combinadoId } }));
}

export async function enviarDocumento(auth: SessionUser, id: string, dados: Envio): Promise<DocumentoRow> {
  const t = await buscarEditavel(auth, id);
  const arquivo = await enviarArquivo(auth, BUCKET_DOCUMENTOS, { pasta: t.id, ...dados }, t.user_id);
  try {
    return toDocumento(
      await prisma.tutoria_documentos.create({
        data: { tutorado_id: id, user_id: t.user_id, storage_path: arquivo.path, nome_arquivo: arquivo.nome, mime_type: arquivo.mime_type, tamanho_bytes: arquivo.tamanho_bytes },
      }),
    );
  } catch (err) {
    await armazenamento.excluir(BUCKET_DOCUMENTOS, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

/** O que dá para apagar de um tutorado, por nome na rota. */
export const ITENS = ['checkins', 'registros', 'combinados', 'documentos'] as const;
export type Item = (typeof ITENS)[number];

/** Apaga um item do acompanhamento (o documento sai também do armazenamento). */
export async function deleteItem(auth: SessionUser, id: string, item: Item, itemId: string): Promise<void> {
  await buscarEditavel(auth, id);
  if (!isUuid(itemId)) throw itemNaoEncontrado();
  const where = { id: itemId, tutorado_id: id };
  if (item === 'documentos') {
    const doc = await prisma.tutoria_documentos.findFirst({ where });
    if (!doc) throw itemNaoEncontrado();
    await prisma.tutoria_documentos.delete({ where: { id: doc.id } });
    await armazenamento.excluir(BUCKET_DOCUMENTOS, [doc.storage_path]);
    return;
  }
  const tabelas: Record<Exclude<Item, 'documentos'>, (w: typeof where) => Promise<Prisma.BatchPayload>> = {
    checkins: (w) => prisma.tutoria_checkins.deleteMany({ where: w }),
    registros: (w) => prisma.tutoria_registros.deleteMany({ where: w }),
    combinados: (w) => prisma.tutoria_combinados.deleteMany({ where: w }),
  };
  if (!(await tabelas[item](where)).count) throw itemNaoEncontrado();
}
