import type { agenda_escola_eventos, apoio_presencial, Prisma, tipo_evento_escola } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalBoolean, optionalChoice, optionalDate, optionalString, requiredText } from '../../lib/body';
import { isGestao } from '../../middlewares/roles';
import type { SessionUser } from '../auth/auth.service';
import { listaDeIds } from '../avaliacoes/avaliacoes.service';

// ===== Eventos da escola e apoio presencial: o calendário da escola, mantido pela gestão =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const eventoNaoEncontrado = () => new HttpError(404, 'EVENTO_NAO_ENCONTRADO', 'Evento não encontrado.');
export const apoioNaoEncontrado = () => new HttpError(404, 'APOIO_NAO_ENCONTRADO', 'Apoio presencial não encontrado.');

export const TIPOS_EVENTO: tipo_evento_escola[] = [
  'reuniao', 'formacao', 'evento', 'avaliacao_externa', 'conselho', 'apoio_presencial', 'acompanhamento', 'observacao', 'visita', 'aviso',
];

const DATA_HORA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Data e hora: `AAAA-MM-DD`, `AAAA-MM-DDTHH:MM` (o campo da tela) ou com fuso. Sem fuso, vale como
 * UTC, que é como o Supabase gravava o mesmo texto.
 */
function lerDataHora(body: unknown, campo: string): Date | null | undefined {
  const v = (body as Record<string, unknown> | undefined)?.[campo];
  if (v === undefined || v === null || v === '') return v === undefined ? undefined : null;
  if (typeof v !== 'string' || !DATA_HORA.test(v)) throw invalido(`"${campo}" deve ser uma data (AAAA-MM-DD) ou data e hora (AAAA-MM-DDTHH:MM).`);
  // O dia precisa existir (recusa 30/02), independentemente do fuso.
  const dia = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== v.slice(0, 10)) throw invalido(`"${campo}" não é uma data válida.`);
  const comHora = v.includes('T') ? v : `${v}T00:00`;
  const d = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(comHora) ? comHora : `${comHora}Z`);
  if (Number.isNaN(d.getTime())) throw invalido(`"${campo}" não é uma data válida.`);
  return d;
}

function periodo(campo: string, de?: string, ate?: string) {
  const inicio = de === undefined ? undefined : optionalDate({ de }, 'de') ?? undefined;
  const fim = ate === undefined ? undefined : optionalDate({ ate }, 'ate') ?? undefined;
  if (!inicio && !fim) return {};
  // `ate` inclui o dia inteiro.
  return { [campo]: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: new Date(fim.getTime() + 86_400_000) } : {}) } };
}

// ----- Eventos da escola -----

function lerEvento(body: unknown, parcial: boolean) {
  const data_inicio = lerDataHora(body, 'data_inicio');
  if (data_inicio === null || (!parcial && data_inicio === undefined)) throw invalido('O campo "data_inicio" é obrigatório.');
  const cor = optionalString(body, 'cor');
  if (cor && cor.length > 30) throw invalido('"cor" inválida.');
  return {
    titulo: requiredText(body, 'titulo', parcial),
    descricao: optionalString(body, 'descricao'),
    tipo: optionalChoice(body, 'tipo', TIPOS_EVENTO) as tipo_evento_escola | undefined,
    data_inicio,
    data_fim: lerDataHora(body, 'data_fim'),
    dia_todo: optionalBoolean(body, 'dia_todo'),
    cor,
  };
}

function assertOrdem(inicio: Date, fim: Date | null | undefined) {
  if (fim && fim < inicio) throw invalido('O fim do evento não pode ser antes do início.');
}

/** Todo usuário logado vê. Filtros: período (`de`, `ate`, pelo início) e `tipo`. Em ordem de início. */
export async function listEventos(f: { de?: string; ate?: string; tipo?: string }): Promise<agenda_escola_eventos[]> {
  if (f.tipo !== undefined && !TIPOS_EVENTO.includes(f.tipo as tipo_evento_escola)) throw invalido('"tipo" inválido.');
  return prisma.agenda_escola_eventos.findMany({
    where: { ...periodo('data_inicio', f.de, f.ate), ...(f.tipo ? { tipo: f.tipo as tipo_evento_escola } : {}) },
    orderBy: { data_inicio: 'asc' },
  });
}

/** `{ titulo, data_inicio, data_fim?, dia_todo?, tipo?, descricao?, cor? }`. Só a gestão. */
export async function createEvento(auth: SessionUser, body: unknown): Promise<agenda_escola_eventos> {
  const dados = lerEvento(body, false);
  assertOrdem(dados.data_inicio!, dados.data_fim);
  return prisma.agenda_escola_eventos.create({ data: { ...dados, titulo: dados.titulo!, data_inicio: dados.data_inicio!, criado_por: auth.user.id } });
}

/** Qualquer pessoa da gestão altera: o calendário é da escola, não de quem criou. */
export async function updateEvento(id: string, body: unknown): Promise<agenda_escola_eventos> {
  const dados = lerEvento(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const atual = await prisma.agenda_escola_eventos.findUnique({ where: { id } });
  if (!atual) throw eventoNaoEncontrado();
  assertOrdem(dados.data_inicio ?? atual.data_inicio, dados.data_fim === undefined ? atual.data_fim : dados.data_fim);
  return prisma.agenda_escola_eventos.update({ where: { id }, data: dados });
}

export async function deleteEvento(id: string): Promise<void> {
  const { count } = await prisma.agenda_escola_eventos.deleteMany({ where: { id } });
  if (!count) throw eventoNaoEncontrado();
}

// ----- Apoio presencial: um responsável acompanha a aula de um professor -----

export type ApoioRow = Omit<apoio_presencial, 'data'> & { data: string };
const toApoio = (a: apoio_presencial): ApoioRow => ({ ...a, data: a.data.toISOString().slice(0, 10) });

const comNomes = {
  professor: { select: { profile: { select: { nome: true } } } },
  responsavel: { select: { profile: { select: { nome: true } } } },
} satisfies Prisma.apoio_presencialInclude;

/** Na lista, vêm também os nomes (o professor não pode ler a lista de usuários para descobri-los). */
export type ApoioComNomes = ApoioRow & { professor_nome: string | null; responsavel_nome: string | null };

/** A gestão vê todos; o professor, só os seus (como professor acompanhado ou como responsável). */
export async function listApoios(auth: SessionUser, f: { de?: string; ate?: string; professor_id?: string }): Promise<ApoioComNomes[]> {
  const [professor_id] = listaDeIds(f.professor_id, 'professor_id', 1);
  const meus: Prisma.apoio_presencialWhereInput = isGestao(auth.role)
    ? {}
    : { OR: [{ professor_id: auth.user.id }, { responsavel_id: auth.user.id }] };
  const lista = await prisma.apoio_presencial.findMany({
    where: { AND: [meus, professor_id ? { professor_id } : {}], ...periodo('data', f.de, f.ate) },
    orderBy: [{ data: 'asc' }, { created_at: 'asc' }],
    include: comNomes,
  });
  return lista.map(({ professor, responsavel, ...a }) => ({
    ...toApoio(a),
    professor_nome: professor.profile?.nome ?? null,
    responsavel_nome: responsavel.profile?.nome ?? null,
  }));
}

async function lerApoio(body: unknown, parcial: boolean) {
  const data = optionalDate(body, 'data');
  if (data === null || (!parcial && data === undefined)) throw invalido('O campo "data" é obrigatório.');
  const professor_id = optionalString(body, 'professor_id');
  const responsavel_id = optionalString(body, 'responsavel_id');
  for (const [campo, valor] of Object.entries({ professor_id, responsavel_id })) {
    if (valor === null || (!parcial && valor === undefined)) throw invalido(`O campo "${campo}" é obrigatório.`);
  }
  const pessoas = [professor_id, responsavel_id].filter((p): p is string => !!p);
  if (pessoas.some((p) => !isUuid(p)) || (await prisma.usuarios.count({ where: { id: { in: pessoas } } })) !== new Set(pessoas).size) {
    throw new HttpError(400, 'USUARIO_INVALIDO', 'O professor ou o responsável informado não existe.');
  }
  const horario_grade_id = optionalString(body, 'horario_grade_id');
  if (horario_grade_id && (!isUuid(horario_grade_id) || !(await prisma.horario_grade.findUnique({ where: { id: horario_grade_id } })))) {
    throw new HttpError(400, 'HORARIO_INVALIDO', 'O horário da grade não existe.');
  }
  return { data, professor_id: professor_id ?? undefined, responsavel_id: responsavel_id ?? undefined, horario_grade_id, observacao: optionalString(body, 'observacao') };
}

/** `{ data, professor_id, responsavel_id, horario_grade_id?, observacao? }`. Só a gestão. */
export async function createApoio(auth: SessionUser, body: unknown): Promise<ApoioRow> {
  const dados = await lerApoio(body, false);
  return toApoio(
    await prisma.apoio_presencial.create({
      data: { ...dados, data: dados.data!, professor_id: dados.professor_id!, responsavel_id: dados.responsavel_id!, criado_por: auth.user.id },
    }),
  );
}

export async function updateApoio(id: string, body: unknown): Promise<ApoioRow> {
  const dados = await lerApoio(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  if (!(await prisma.apoio_presencial.findUnique({ where: { id } }))) throw apoioNaoEncontrado();
  return toApoio(await prisma.apoio_presencial.update({ where: { id }, data: dados }));
}

export async function deleteApoio(id: string): Promise<void> {
  const { count } = await prisma.apoio_presencial.deleteMany({ where: { id } });
  if (!count) throw apoioNaoEncontrado();
}
