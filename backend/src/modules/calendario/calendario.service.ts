import { $Enums, type ano_letivo, type horario_grade, type tipo_bloco_horario } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { optionalBoolean, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
/** Datas puras (AAAA-MM-DD) e horários (HH:MM:SS), como o Postgres/Supabase devolve. */
const dia = (d: Date) => d.toISOString().slice(0, 10);
const hora = (d: Date) => d.toISOString().slice(11, 19);

// ===== Grade de horários (horario_grade): as faixas do dia, usadas pela agenda =====

export const TIPOS_BLOCO = Object.values($Enums.tipo_bloco_horario);
export const horarioNaoEncontrado = () => new HttpError(404, 'HORARIO_NAO_ENCONTRADO', 'Horário não encontrado.');

export type HorarioRow = Omit<horario_grade, 'hora_inicio' | 'hora_fim'> & { hora_inicio: string; hora_fim: string };
const toHorario = (h: horario_grade): HorarioRow => ({ ...h, hora_inicio: hora(h.hora_inicio), hora_fim: hora(h.hora_fim) });

const HORA = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

/** Horário opcional `HH:MM` ou `HH:MM:SS`, guardado como TIME (o Prisma usa 1970-01-01 UTC). */
function optionalTime(body: unknown, field: string, parcial: boolean): Date | undefined {
  const value = optionalString(body, field);
  if (value === undefined && parcial) return undefined;
  if (!value) throw invalido(`O campo "${field}" é obrigatório.`);
  const m = value.match(HORA);
  if (!m) throw invalido(`O campo "${field}" deve ser um horário no formato HH:MM.`);
  return new Date(`1970-01-01T${m[1]}:${m[2]}:${m[4] ?? '00'}.000Z`);
}

function lerHorario(body: unknown, parcial: boolean) {
  const ordem = optionalInt(body, 'ordem', 1, 100);
  if (ordem === null || (ordem === undefined && !parcial)) throw invalido('O campo "ordem" é obrigatório.');
  return {
    ordem,
    rotulo: requiredText(body, 'rotulo', parcial),
    hora_inicio: optionalTime(body, 'hora_inicio', parcial),
    hora_fim: optionalTime(body, 'hora_fim', parcial),
    tipo: optionalChoice(body, 'tipo', TIPOS_BLOCO) as tipo_bloco_horario | undefined,
  };
}

function assertIntervalo(inicio: Date, fim: Date) {
  if (fim <= inicio) throw invalido('O horário de fim precisa ser depois do de início.');
}

/** Todo usuário logado lê (padrão C). Em ordem do dia. */
export async function listHorarios(): Promise<HorarioRow[]> {
  return (await prisma.horario_grade.findMany({ orderBy: [{ ordem: 'asc' }, { hora_inicio: 'asc' }] })).map(toHorario);
}

export async function createHorario(body: unknown): Promise<HorarioRow> {
  const dados = lerHorario(body, false);
  assertIntervalo(dados.hora_inicio!, dados.hora_fim!);
  return toHorario(
    await prisma.horario_grade.create({
      data: { ...dados, ordem: dados.ordem!, rotulo: dados.rotulo!, hora_inicio: dados.hora_inicio!, hora_fim: dados.hora_fim! },
    }),
  );
}

export async function updateHorario(id: string, body: unknown): Promise<HorarioRow> {
  const dados = lerHorario(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const atual = await prisma.horario_grade.findUnique({ where: { id } });
  if (!atual) throw horarioNaoEncontrado();
  assertIntervalo(dados.hora_inicio ?? atual.hora_inicio, dados.hora_fim ?? atual.hora_fim);
  return toHorario(await prisma.horario_grade.update({ where: { id }, data: dados }));
}

/**
 * No banco, apagar uma faixa apagaria junto a rotina e as exceções da agenda de todos os
 * professores naquele horário. Por isso só sai faixa que ninguém usa (como a turma com alunos).
 */
export async function deleteHorario(id: string): Promise<void> {
  const emUso = { OR: [{ agenda_professor: { some: {} } }, { agenda_excecoes: { some: {} } }] };
  const { count } = await prisma.horario_grade.deleteMany({ where: { id, NOT: emUso } });
  if (count > 0) return;
  if (!(await prisma.horario_grade.findUnique({ where: { id }, select: { id: true } }))) throw horarioNaoEncontrado();
  throw new HttpError(409, 'HORARIO_EM_USO', 'Este horário está na agenda de algum professor. Altere-o em vez de excluir.');
}

// ===== Ano letivo: início e fim de cada ano escolar =====

export const anoNaoEncontrado = () => new HttpError(404, 'ANO_LETIVO_NAO_ENCONTRADO', 'Ano letivo não encontrado.');

export type AnoLetivoRow = Omit<ano_letivo, 'data_inicio' | 'data_fim'> & { data_inicio: string; data_fim: string };
const toAno = (a: ano_letivo): AnoLetivoRow => ({ ...a, data_inicio: dia(a.data_inicio), data_fim: dia(a.data_fim) });

function lerAno(body: unknown, parcial: boolean) {
  const ano = optionalInt(body, 'ano', 2000, 2100);
  const data_inicio = optionalDate(body, 'data_inicio');
  const data_fim = optionalDate(body, 'data_fim');
  for (const [campo, valor] of Object.entries({ ano, data_inicio, data_fim })) {
    if (valor === null || (valor === undefined && !parcial)) throw invalido(`O campo "${campo}" é obrigatório.`);
  }
  return {
    ano: ano ?? undefined,
    data_inicio: data_inicio ?? undefined,
    data_fim: data_fim ?? undefined,
    ativo: optionalBoolean(body, 'ativo'),
  };
}

function assertPeriodo(inicio: Date, fim: Date) {
  if (fim <= inicio) throw invalido('A data de fim precisa ser depois da de início.');
}

async function assertAnoLivre(ano: number, ignorarId?: string) {
  const existe = await prisma.ano_letivo.findFirst({ where: { ano, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) } });
  if (existe) throw new HttpError(409, 'ANO_LETIVO_DUPLICADO', `O ano letivo ${ano} já está cadastrado.`);
}

/** Todo usuário logado lê (padrão C). Do mais recente para o mais antigo. */
export async function listAnos(): Promise<AnoLetivoRow[]> {
  return (await prisma.ano_letivo.findMany({ orderBy: { ano: 'desc' } })).map(toAno);
}

export async function createAno(body: unknown): Promise<AnoLetivoRow> {
  const dados = lerAno(body, false);
  assertPeriodo(dados.data_inicio!, dados.data_fim!);
  await assertAnoLivre(dados.ano!);
  return toAno(
    await prisma.ano_letivo.create({
      data: { ...dados, ano: dados.ano!, data_inicio: dados.data_inicio!, data_fim: dados.data_fim! },
    }),
  );
}

export async function updateAno(id: string, body: unknown): Promise<AnoLetivoRow> {
  const dados = lerAno(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const atual = await prisma.ano_letivo.findUnique({ where: { id } });
  if (!atual) throw anoNaoEncontrado();
  assertPeriodo(dados.data_inicio ?? atual.data_inicio, dados.data_fim ?? atual.data_fim);
  if (dados.ano !== undefined) await assertAnoLivre(dados.ano, id);
  return toAno(await prisma.ano_letivo.update({ where: { id }, data: dados }));
}

/** Nada no banco depende da tabela de anos letivos, então pode sair. */
export async function deleteAno(id: string): Promise<void> {
  const { count } = await prisma.ano_letivo.deleteMany({ where: { id } });
  if (count === 0) throw anoNaoEncontrado();
}
