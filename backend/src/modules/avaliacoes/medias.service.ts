import { Prisma, type medias_arredondadas } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalInt, optionalString } from '../../lib/body';
import { filtroLeitura, podeEscrever, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { bimestreDaQuery, listaDeIds } from './avaliacoes.service';

// ===== Médias arredondadas: a nota final que o professor ajusta à mão (6,8 → 7) =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);

export type MediaRow = Omit<medias_arredondadas, 'nota_arredondada'> & { nota_arredondada: number };
const toMedia = (m: medias_arredondadas): MediaRow => ({ ...m, nota_arredondada: m.nota_arredondada.toNumber() });

export const MAX_MEDIAS = 2000;

/** Padrão A. Filtros da planilha: turma, matéria, bimestre e alunos (um ou vários). */
export async function listMedias(
  auth: SessionUser,
  f: { turma_id?: string; disciplina_id?: string; bimestre?: string; aluno_id?: string | string[] },
): Promise<MediaRow[]> {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const alunos = listaDeIds(f.aluno_id, 'aluno_id', MAX_MEDIAS);
  const bimestre = bimestreDaQuery(f.bimestre);
  const lista = await prisma.medias_arredondadas.findMany({
    where: {
      ...filtroLeitura(auth),
      ...(turma_id ? { turma_id } : {}),
      ...(disciplina_id ? { disciplina_id } : {}),
      ...(bimestre ? { bimestre } : {}),
      ...(alunos.length ? { aluno_id: { in: alunos } } : {}),
    },
    orderBy: { created_at: 'asc' },
  });
  return lista.map(toMedia);
}

/**
 * A planilha (turma, matéria e bimestre) de quem pede. O dono das médias é o professor dono da
 * matéria, mesmo quando o admin altera. Devolve o dono.
 */
async function planilhaEditavel(auth: SessionUser, body: unknown) {
  const turma_id = optionalString(body, 'turma_id');
  const disciplina_id = optionalString(body, 'disciplina_id');
  const bimestre = optionalInt(body, 'bimestre', 1, 4);
  for (const [campo, valor] of Object.entries({ turma_id, disciplina_id, bimestre })) {
    if (valor === null || valor === undefined) throw invalido(`O campo "${campo}" é obrigatório.`);
  }
  const turma = isUuid(turma_id!) ? await prisma.turmas.findUnique({ where: { id: turma_id! }, select: { user_id: true } }) : null;
  if (!turma || !podeLer(auth, turma.user_id)) throw new HttpError(400, 'TURMA_INVALIDA', 'A turma informada não existe.');
  const d = isUuid(disciplina_id!) ? await prisma.disciplinas.findUnique({ where: { id: disciplina_id! }, select: { user_id: true } }) : null;
  if (!d || !podeLer(auth, d.user_id)) throw new HttpError(400, 'DISCIPLINA_INVALIDA', 'A matéria informada não existe.');
  if (!podeEscrever(auth, d.user_id)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só o professor dono da matéria ajusta as médias.');
  return { turma_id: turma_id!, disciplina_id: disciplina_id!, bimestre: bimestre!, user_id: d.user_id };
}

interface AjusteMedia {
  aluno_id: string;
  nota_arredondada: number | null;
  manual: boolean;
}

function lerAjustes(body: unknown): AjusteMedia[] {
  const lista = (body as { medias?: unknown } | undefined)?.medias;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie "medias" com pelo menos um aluno.');
  if (lista.length > MAX_MEDIAS) throw invalido(`No máximo ${MAX_MEDIAS} médias por vez.`);
  const vistos = new Set<string>();
  return lista.map((item: unknown, i) => {
    const m = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const onde = `Média ${i + 1}`;
    if (typeof m.aluno_id !== 'string' || !isUuid(m.aluno_id)) throw invalido(`${onde}: "aluno_id" inválido.`);
    const nota = m.nota_arredondada;
    if (nota !== null && (typeof nota !== 'number' || !(nota >= 0 && nota <= 10))) {
      throw invalido(`${onde}: a média deve ser de 0 a 10 (ou null para voltar ao cálculo automático).`);
    }
    if (m.manual !== undefined && typeof m.manual !== 'boolean') throw invalido(`${onde}: "manual" deve ser verdadeiro ou falso.`);
    if (vistos.has(m.aluno_id)) throw invalido(`${onde}: o mesmo aluno aparece duas vezes.`);
    vistos.add(m.aluno_id);
    return { aluno_id: m.aluno_id, nota_arredondada: nota as number | null, manual: (m.manual as boolean | undefined) ?? true };
  });
}

/** O aluno precisa ser da turma: direto ou como membro (eletiva). */
async function assertAlunosDaTurma(alunoIds: string[], turma_id: string) {
  const [alunos, membros] = await Promise.all([
    prisma.alunos.findMany({ where: { id: { in: alunoIds } }, select: { id: true, turma_id: true } }),
    prisma.turma_membros.findMany({ where: { turma_id, aluno_id: { in: alunoIds } }, select: { aluno_id: true } }),
  ]);
  const turmaDe = new Map(alunos.map((a) => [a.id, a.turma_id]));
  const membro = new Set(membros.map((m) => m.aluno_id));
  alunoIds.forEach((id, i) => {
    if (!turmaDe.has(id)) throw new HttpError(400, 'ALUNO_INVALIDO', `Média ${i + 1}: o aluno não existe.`);
    if (turmaDe.get(id) !== turma_id && !membro.has(id)) {
      throw new HttpError(400, 'ALUNO_FORA_DA_TURMA', `Média ${i + 1}: o aluno não é desta turma.`);
    }
  });
}

/**
 * `{ turma_id, disciplina_id, bimestre, medias: [{ aluno_id, nota_arredondada, manual? }] }`:
 * guarda ou corrige a média ajustada de um ou vários alunos da planilha. `nota_arredondada: null`
 * apaga o ajuste (o aluno volta ao cálculo automático). Ou entra tudo, ou nada.
 */
export async function salvarMedias(auth: SessionUser, body: unknown): Promise<{ salvas: MediaRow[]; apagadas: number }> {
  const planilha = await planilhaEditavel(auth, body);
  const ajustes = lerAjustes(body);
  await assertAlunosDaTurma(
    ajustes.map((a) => a.aluno_id),
    planilha.turma_id,
  );
  const { user_id, disciplina_id, bimestre, turma_id } = planilha;
  const salvar = ajustes.filter((a) => a.nota_arredondada !== null);
  const apagar = ajustes.filter((a) => a.nota_arredondada === null).map((a) => a.aluno_id);
  const resultado = await prisma.$transaction([
    ...salvar.map((a) => {
      const dados = { turma_id, nota_arredondada: new Prisma.Decimal(a.nota_arredondada!.toFixed(2)), manual: a.manual };
      return prisma.medias_arredondadas.upsert({
        where: { user_id_aluno_id_disciplina_id_bimestre: { user_id, aluno_id: a.aluno_id, disciplina_id, bimestre } },
        create: { user_id, aluno_id: a.aluno_id, disciplina_id, bimestre, ...dados },
        update: dados,
      });
    }),
    ...(apagar.length ? [prisma.medias_arredondadas.deleteMany({ where: { user_id, disciplina_id, bimestre, aluno_id: { in: apagar } } })] : []),
  ]);
  const apagadas = apagar.length ? (resultado.at(-1) as Prisma.BatchPayload).count : 0;
  return { salvas: (resultado.slice(0, salvar.length) as medias_arredondadas[]).map(toMedia), apagadas };
}

/**
 * `{ turma_id, disciplina_id, bimestre, aluno_ids? }`: descarta os ajustes da planilha (todos, ou
 * só dos alunos informados). Todos voltam ao cálculo automático; as notas não mudam.
 */
export async function descartarMedias(auth: SessionUser, body: unknown): Promise<{ apagadas: number }> {
  const { user_id, turma_id, disciplina_id, bimestre } = await planilhaEditavel(auth, body);
  const ids = (body as { aluno_ids?: unknown }).aluno_ids;
  if (ids !== undefined && (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string' || !isUuid(i)))) {
    throw invalido('"aluno_ids" deve ser uma lista de ids de alunos.');
  }
  if (Array.isArray(ids) && ids.length > MAX_MEDIAS) throw invalido(`No máximo ${MAX_MEDIAS} alunos por vez.`);
  const { count } = await prisma.medias_arredondadas.deleteMany({
    where: { user_id, turma_id, disciplina_id, bimestre, ...(Array.isArray(ids) ? { aluno_id: { in: ids as string[] } } : {}) },
  });
  return { apagadas: count };
}
