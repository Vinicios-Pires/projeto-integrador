import type { disciplinas, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';

/** Cores da tela Matérias (CORES_DISCIPLINA). */
export const CORES = ['azul', 'roxo', 'verde', 'vermelho', 'laranja', 'rosa', 'amarelo', 'ciano', 'indigo', 'cinza'];
/** A tela marca a matéria como inativa com esta "cor" especial. */
export const COR_INATIVA = '__inativa';

export const disciplinaNaoEncontrada = () => new HttpError(404, 'DISCIPLINA_NAO_ENCONTRADA', 'Matéria não encontrada.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);

/** Lê só os campos editáveis do corpo. O dono é sempre quem cria e não muda depois. */
function lerDados(body: unknown, parcial: boolean) {
  return {
    nome: requiredText(body, 'nome', parcial),
    cor: optionalChoice(body, 'cor', [...CORES, COR_INATIVA]),
    professor: optionalString(body, 'professor'),
    carga_horaria: optionalInt(body, 'carga_horaria', 0, 10000),
  };
}

async function buscarEditavel(auth: SessionUser, id: string): Promise<disciplinas> {
  const disciplina = await prisma.disciplinas.findUnique({ where: { id } });
  if (!disciplina) throw disciplinaNaoEncontrada();
  exigirEscrita(auth, disciplina.user_id, disciplinaNaoEncontrada, 'Só o professor dono da matéria pode alterá-la.');
  return disciplina;
}

/** Padrão A: o professor vê as próprias matérias; a gestão vê as de todos. Em ordem de nome. */
export async function listDisciplinas(auth: SessionUser): Promise<disciplinas[]> {
  return prisma.disciplinas.findMany({ where: filtroLeitura(auth), orderBy: { nome: 'asc' } });
}

export async function getDisciplina(auth: SessionUser, id: string): Promise<disciplinas> {
  const disciplina = await prisma.disciplinas.findUnique({ where: { id } });
  if (!disciplina || !podeLer(auth, disciplina.user_id)) throw disciplinaNaoEncontrada();
  return disciplina;
}

export async function createDisciplina(auth: SessionUser, body: unknown): Promise<disciplinas> {
  const dados = lerDados(body, false);
  return prisma.disciplinas.create({ data: { ...dados, nome: dados.nome!, user_id: auth.user.id } });
}

export async function updateDisciplina(auth: SessionUser, id: string, body: unknown): Promise<disciplinas> {
  const dados = lerDados(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarEditavel(auth, id);
  return prisma.disciplinas.update({ where: { id }, data: dados });
}

/**
 * Os vínculos com turmas saem junto. Planos, notas, provas etc. da matéria continuam
 * existindo, só ficam sem matéria (regra do banco).
 */
export async function deleteDisciplina(auth: SessionUser, id: string): Promise<void> {
  await buscarEditavel(auth, id);
  await prisma.disciplinas.delete({ where: { id } });
}

// ===== Vínculos matéria ↔ turma (turma_disciplinas): em quais turmas a matéria aparece =====

const comTurmaEDisciplina = {
  turma: { select: { id: true, nome: true, serie: true, tipo: true } },
  disciplina: { select: { id: true, nome: true, cor: true, user_id: true } },
} satisfies Prisma.turma_disciplinasInclude;
type VinculoComDados = Prisma.turma_disciplinasGetPayload<{ include: typeof comTurmaEDisciplina }>;

/** Um vínculo com a turma e a matéria juntas (como `select('*, turmas(...), disciplinas(...)')`). */
export type VinculoRow = Omit<VinculoComDados, 'turma' | 'disciplina'> & {
  turmas: VinculoComDados['turma'];
  disciplinas: VinculoComDados['disciplina'];
};

const toVinculo = ({ turma, disciplina, ...v }: VinculoComDados): VinculoRow => ({ ...v, turmas: turma, disciplinas: disciplina });

export interface FiltrosVinculos {
  turma_id?: string;
  disciplina_id?: string;
  user_id?: string;
}

/** Padrão A: o professor vê os próprios vínculos; a gestão vê os de todos. */
export async function listVinculos(auth: SessionUser, filtros: FiltrosVinculos): Promise<VinculoRow[]> {
  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor !== undefined && !isUuid(valor)) throw invalido(`"${campo}" inválido.`);
  }
  const lista = await prisma.turma_disciplinas.findMany({
    where: {
      ...(filtros.turma_id ? { turma_id: filtros.turma_id } : {}),
      ...(filtros.disciplina_id ? { disciplina_id: filtros.disciplina_id } : {}),
      ...(filtros.user_id ? { user_id: filtros.user_id } : {}),
      ...filtroLeitura(auth),
    },
    include: comTurmaEDisciplina,
    orderBy: [{ turma: { nome: 'asc' } }, { disciplina: { nome: 'asc' } }],
  });
  return lista.map(toVinculo);
}

export const MAX_TURMAS_POR_DISCIPLINA = 500;

/**
 * `{ turma_ids: [...] }`: define de uma vez em quais turmas a matéria aparece (a lista
 * substitui a anterior; `[]` tira de todas). Os vínculos ficam no nome do dono da matéria,
 * mesmo quando é o admin quem altera. Só entram turmas que quem está alterando enxerga.
 */
export async function setTurmasDaDisciplina(auth: SessionUser, id: string, body: unknown): Promise<VinculoRow[]> {
  const turmaIds = (body as { turma_ids?: unknown } | undefined)?.turma_ids;
  if (!Array.isArray(turmaIds) || turmaIds.some((t) => typeof t !== 'string')) {
    throw invalido('Envie "turma_ids" com a lista de turmas (pode ser vazia).');
  }
  const ids = [...new Set(turmaIds as string[])];
  if (ids.length > MAX_TURMAS_POR_DISCIPLINA) throw invalido(`No máximo ${MAX_TURMAS_POR_DISCIPLINA} turmas.`);

  const disciplina = await buscarEditavel(auth, id);
  const turmas = ids.every(isUuid)
    ? await prisma.turmas.findMany({ where: { id: { in: ids } }, select: { user_id: true } })
    : [];
  if (turmas.length !== ids.length || !turmas.every((t) => podeLer(auth, t.user_id))) {
    throw new HttpError(400, 'TURMA_INVALIDA', 'Uma das turmas informadas não existe.');
  }

  const dono = disciplina.user_id;
  await prisma.$transaction([
    prisma.turma_disciplinas.deleteMany({ where: { disciplina_id: id, user_id: dono, turma_id: { notIn: ids } } }),
    prisma.turma_disciplinas.createMany({
      data: ids.map((turma_id) => ({ turma_id, disciplina_id: id, user_id: dono })),
      skipDuplicates: true,
    }),
  ]);
  return listVinculos(auth, { disciplina_id: id, user_id: dono });
}
