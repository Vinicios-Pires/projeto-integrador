import type { ocorrencia_fotos, ocorrencias_escolares, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalBoolean, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import { isGestao } from '../../middlewares/roles';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, listaDeIds } from '../avaliacoes/avaliacoes.service';
import { armazenamento, enviarArquivo } from '../files/files.service';

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
const dia = (d: Date) => d.toISOString().slice(0, 10);

function periodo(campo: string, de?: string, ate?: string) {
  const inicio = de === undefined ? undefined : optionalDate({ de }, 'de') ?? undefined;
  const fim = ate === undefined ? undefined : optionalDate({ ate }, 'ate') ?? undefined;
  if (!inicio && !fim) return {};
  return { [campo]: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } };
}

// ===== Ocorrências do notebook (uso dos notebooks em sala), com fotos =====

export const ocorrenciaNaoEncontrada = () => new HttpError(404, 'OCORRENCIA_NAO_ENCONTRADA', 'Ocorrência não encontrada.');
export const BUCKET_FOTOS = 'ocorrencias-fotos';

const comDados = {
  turma: { select: { nome: true, serie: true } },
  fotos: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.ocorrencias_notebookInclude;
type NotebookComDados = Prisma.ocorrencias_notebookGetPayload<{ include: typeof comDados }>;

/** Com a turma e as fotos junto (o link de cada foto sai de `/files/ocorrencias-fotos/url`). */
export type NotebookRow = Omit<NotebookComDados, 'turma' | 'data_ocorrencia'> & { data_ocorrencia: string; turmas: NotebookComDados['turma'] };
const toNotebook = ({ turma, data_ocorrencia, ...o }: NotebookComDados): NotebookRow => ({ ...o, data_ocorrencia: dia(data_ocorrencia), turmas: turma });

function lerNotebook(body: unknown) {
  const data_ocorrencia = optionalDate(body, 'data_ocorrencia');
  if (data_ocorrencia === null) throw invalido('O campo "data_ocorrencia" não pode ficar vazio.');
  return {
    turma_id: optionalString(body, 'turma_id'),
    data_ocorrencia,
    quantidade_notebooks: optionalInt(body, 'quantidade_notebooks', 0, 1000),
    alunos_envolvidos: optionalString(body, 'alunos_envolvidos'),
    problema_encontrado: optionalString(body, 'problema_encontrado'),
    descricao: optionalString(body, 'descricao'),
    equipamento_danificado: optionalBoolean(body, 'equipamento_danificado'),
    internet_funcionou: optionalBoolean(body, 'internet_funcionou'),
    solucao_adotada: optionalString(body, 'solucao_adotada'),
    observacoes: optionalString(body, 'observacoes'),
  };
}

async function buscarNotebookEditavel(auth: SessionUser, id: string) {
  const o = await prisma.ocorrencias_notebook.findUnique({ where: { id } });
  if (!o) throw ocorrenciaNaoEncontrada();
  exigirEscrita(auth, o.user_id, ocorrenciaNaoEncontrada, 'Só quem registrou a ocorrência pode alterá-la.');
  return o;
}

/** Padrão A. Filtros: turma e período. As mais recentes primeiro. */
export async function listNotebook(auth: SessionUser, f: { turma_id?: string; de?: string; ate?: string }): Promise<NotebookRow[]> {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const lista = await prisma.ocorrencias_notebook.findMany({
    where: { ...filtroLeitura(auth), ...(turma_id ? { turma_id } : {}), ...periodo('data_ocorrencia', f.de, f.ate) },
    include: comDados,
    orderBy: [{ data_ocorrencia: 'desc' }, { created_at: 'desc' }],
  });
  return lista.map(toNotebook);
}

export async function getNotebook(auth: SessionUser, id: string): Promise<NotebookRow> {
  const o = await prisma.ocorrencias_notebook.findUnique({ where: { id }, include: comDados });
  if (!o || !podeLer(auth, o.user_id)) throw ocorrenciaNaoEncontrada();
  return toNotebook(o);
}

export async function createNotebook(auth: SessionUser, body: unknown): Promise<NotebookRow> {
  const dados = lerNotebook(body);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, undefined);
  return toNotebook(await prisma.ocorrencias_notebook.create({ data: { ...dados, user_id: auth.user.id }, include: comDados }));
}

export async function updateNotebook(auth: SessionUser, id: string, body: unknown): Promise<NotebookRow> {
  const dados = lerNotebook(body);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarNotebookEditavel(auth, id);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, undefined);
  return toNotebook(await prisma.ocorrencias_notebook.update({ where: { id }, data: dados, include: comDados }));
}

/** As fotos saem junto, do banco e do armazenamento. */
export async function deleteNotebook(auth: SessionUser, id: string): Promise<void> {
  await buscarNotebookEditavel(auth, id);
  const fotos = await prisma.ocorrencia_fotos.findMany({ where: { ocorrencia_id: id }, select: { path: true } });
  await prisma.ocorrencias_notebook.delete({ where: { id } });
  if (fotos.length) await armazenamento.excluir(BUCKET_FOTOS, fotos.map((f) => f.path));
}

/** Corpo: a própria foto. Fica na pasta de quem registrou a ocorrência, mesmo quando o admin envia. */
export async function enviarFoto(
  auth: SessionUser,
  id: string,
  dados: { nome: unknown; mime: string | undefined; conteudo: unknown },
): Promise<ocorrencia_fotos> {
  const o = await buscarNotebookEditavel(auth, id);
  const arquivo = await enviarArquivo(auth, BUCKET_FOTOS, { pasta: o.id, ...dados }, o.user_id);
  try {
    // `url` fica vazio, como hoje: o bucket é privado e o link é assinado na hora de mostrar.
    return await prisma.ocorrencia_fotos.create({ data: { ocorrencia_id: id, url: '', path: arquivo.path } });
  } catch (err) {
    await armazenamento.excluir(BUCKET_FOTOS, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

export async function deleteFoto(auth: SessionUser, id: string, fotoId: string): Promise<void> {
  await buscarNotebookEditavel(auth, id);
  const foto = isUuid(fotoId) ? await prisma.ocorrencia_fotos.findFirst({ where: { id: fotoId, ocorrencia_id: id } }) : null;
  if (!foto) throw new HttpError(404, 'FOTO_NAO_ENCONTRADA', 'Foto não encontrada.');
  await prisma.ocorrencia_fotos.delete({ where: { id: foto.id } });
  await armazenamento.excluir(BUCKET_FOTOS, [foto.path]);
}

// ===== Ocorrências escolares: o professor registra, a gestão responde =====

export const TIPOS_ESCOLAR = [
  'comportamento', 'falta de atividade', 'uso inadequado de equipamento', 'conflito', 'atraso', 'sem material', 'conversa excessiva', 'outro',
];
export const STATUS_ESCOLAR = ['nova', 'em_andamento', 'resolvida'];

export type EscolarRow = Omit<ocorrencias_escolares, 'data'> & { data: string };
const toEscolar = (o: ocorrencias_escolares): EscolarRow => ({ ...o, data: dia(o.data) });

/**
 * O professor vê as que registrou; a gestão, todas. Filtros: situação, tipo, professor, período e
 * `aluno` (parte do nome, sem diferenciar maiúsculas).
 */
export async function listEscolares(
  auth: SessionUser,
  f: { status?: string; tipo?: string; user_id?: string; aluno?: string; de?: string; ate?: string },
): Promise<EscolarRow[]> {
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  if (f.status !== undefined && !STATUS_ESCOLAR.includes(f.status)) throw invalido('"status" inválido.');
  const lista = await prisma.ocorrencias_escolares.findMany({
    where: {
      AND: [filtroLeitura(auth), user_id ? { user_id } : {}],
      ...(f.status ? { status: f.status } : {}),
      ...(f.tipo ? { tipo: f.tipo } : {}),
      ...(f.aluno ? { alunos: { contains: f.aluno, mode: 'insensitive' as const } } : {}),
      ...periodo('data', f.de, f.ate),
    },
    orderBy: { created_at: 'desc' },
  });
  return lista.map(toEscolar);
}

async function buscarEscolar(auth: SessionUser, id: string) {
  const o = await prisma.ocorrencias_escolares.findUnique({ where: { id } });
  if (!o || !podeLer(auth, o.user_id)) throw ocorrenciaNaoEncontrada();
  return o;
}

export async function getEscolar(auth: SessionUser, id: string): Promise<EscolarRow> {
  return toEscolar(await buscarEscolar(auth, id));
}

function lerEscolar(body: unknown, parcial: boolean) {
  const data = optionalDate(body, 'data');
  if (data === null) throw invalido('O campo "data" não pode ficar vazio.');
  const tipo = optionalChoice(body, 'tipo', TIPOS_ESCOLAR);
  if (!parcial && !tipo) throw invalido('O campo "tipo" é obrigatório.');
  return {
    data,
    tipo,
    descricao: requiredText(body, 'descricao', parcial),
    turma: optionalString(body, 'turma'),
    disciplina: optionalString(body, 'disciplina'),
    alunos: optionalString(body, 'alunos'),
  };
}

/** `{ tipo, descricao, data?, turma?, disciplina?, alunos? }`: o professor envia para a gestão (nova). */
export async function createEscolar(auth: SessionUser, body: unknown): Promise<EscolarRow> {
  const dados = lerEscolar(body, false);
  return toEscolar(
    await prisma.ocorrencias_escolares.create({ data: { ...dados, tipo: dados.tipo!, descricao: dados.descricao!, user_id: auth.user.id, status: 'nova' } }),
  );
}

/** Quem registrou corrige o texto enquanto a gestão ainda não começou a tratar (situação "nova"). */
export async function updateEscolar(auth: SessionUser, id: string, body: unknown): Promise<EscolarRow> {
  const dados = lerEscolar(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const o = await buscarEscolar(auth, id);
  exigirEscrita(auth, o.user_id, ocorrenciaNaoEncontrada, 'Só quem registrou a ocorrência pode corrigi-la.');
  if (o.status !== 'nova') throw new HttpError(409, 'OCORRENCIA_EM_ATENDIMENTO', 'A gestão já está tratando esta ocorrência; ela não pode mais ser corrigida.');
  return toEscolar(await prisma.ocorrencias_escolares.update({ where: { id }, data: dados }));
}

/**
 * `{ status, providencias? }`: a gestão responde. Grava quem respondeu e quando, e marca como
 * "não vista" para o professor ser avisado.
 */
export async function responderEscolar(auth: SessionUser, id: string, body: unknown): Promise<EscolarRow> {
  if (!isGestao(auth.role)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só a gestão responde às ocorrências.');
  const status = optionalChoice(body, 'status', STATUS_ESCOLAR);
  if (!status) throw invalido(`"status" deve ser ${STATUS_ESCOLAR.join(', ')}.`);
  const providencias = optionalString(body, 'providencias');
  await buscarEscolar(auth, id);
  return toEscolar(
    await prisma.ocorrencias_escolares.update({
      where: { id },
      data: {
        status,
        ...(providencias !== undefined ? { providencias } : {}),
        gestao_user_id: auth.user.id,
        respondido_em: new Date(),
        visto_pelo_professor: false,
      },
    }),
  );
}

/** O professor viu a resposta da gestão. Só quem registrou. */
export async function marcarVista(auth: SessionUser, id: string): Promise<EscolarRow> {
  const o = await buscarEscolar(auth, id);
  if (o.user_id !== auth.user.id) throw new HttpError(403, 'SEM_PERMISSAO', 'Só quem registrou a ocorrência marca como vista.');
  return toEscolar(await prisma.ocorrencias_escolares.update({ where: { id }, data: { visto_pelo_professor: true } }));
}

/** Quem registrou (ou o admin), como na tela. */
export async function deleteEscolar(auth: SessionUser, id: string): Promise<void> {
  const o = await buscarEscolar(auth, id);
  exigirEscrita(auth, o.user_id, ocorrenciaNaoEncontrada, 'Só quem registrou a ocorrência pode removê-la.');
  await prisma.ocorrencias_escolares.delete({ where: { id } });
}
