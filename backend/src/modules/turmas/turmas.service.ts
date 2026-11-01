import type { Prisma, turmas } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';

/** Valores que as telas usam (Turmas.tsx). */
export const TURNOS = ['Manhã', 'Tarde', 'Noturno', 'Integral'];
export const TIPOS = ['regular', 'personalizada'];

/**
 * Uma turma como a tela espera: as colunas da tabela + quantos alunos ela tem e, nas
 * personalizadas (eletivas), quantos membros foram vinculados.
 */
export type TurmaRow = turmas & { alunos_count: number; membros_count: number };

const comContagens = { _count: { select: { alunos: true, turma_membros: true } } } satisfies Prisma.turmasInclude;
type TurmaComContagens = Prisma.turmasGetPayload<{ include: typeof comContagens }>;

function toRow({ _count, ...t }: TurmaComContagens): TurmaRow {
  return { ...t, alunos_count: _count.alunos, membros_count: _count.turma_membros };
}

export const turmaNaoEncontrada = () => new HttpError(404, 'TURMA_NAO_ENCONTRADA', 'Turma não encontrada.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);

/**
 * Lê só os campos editáveis do corpo. Os demais (`id`, `user_id`, datas, contagens) são
 * ignorados: o dono é sempre quem cria e não muda depois.
 */
function lerDados(body: unknown, parcial: boolean): Prisma.turmasUncheckedUpdateInput {
  const ano_letivo = optionalInt(body, 'ano_letivo', 2000, 2100);
  if (ano_letivo === null) throw invalido('O campo "ano_letivo" não pode ficar vazio.');
  return {
    nome: requiredText(body, 'nome', parcial),
    serie: requiredText(body, 'serie', parcial),
    turno: optionalChoice(body, 'turno', TURNOS),
    tipo: optionalChoice(body, 'tipo', TIPOS),
    ano_letivo,
    capacidade: optionalInt(body, 'capacidade', 1, 1000),
    observacoes: optionalString(body, 'observacoes'),
  };
}

/** Turma que o usuário pode ver. Se não puder, responde como se ela não existisse. */
async function buscarVisivel(auth: SessionUser, id: string): Promise<TurmaComContagens> {
  const turma = await prisma.turmas.findUnique({ where: { id }, include: comContagens });
  if (!turma || !podeLer(auth, turma.user_id)) throw turmaNaoEncontrada();
  return turma;
}

async function buscarEditavel(auth: SessionUser, id: string) {
  const turma = await prisma.turmas.findUnique({ where: { id }, include: comContagens });
  if (!turma) throw turmaNaoEncontrada();
  exigirEscrita(auth, turma.user_id, turmaNaoEncontrada, 'Só o professor dono da turma pode alterá-la.');
  return turma;
}

/** Professor vê as próprias turmas; a gestão vê todas. Em ordem de nome, como a tela. */
export async function listTurmas(auth: SessionUser): Promise<TurmaRow[]> {
  const lista = await prisma.turmas.findMany({ where: filtroLeitura(auth), include: comContagens, orderBy: { nome: 'asc' } });
  return lista.map(toRow);
}

export async function getTurma(auth: SessionUser, id: string): Promise<TurmaRow> {
  return toRow(await buscarVisivel(auth, id));
}

export async function createTurma(auth: SessionUser, body: unknown): Promise<TurmaRow> {
  const dados = lerDados(body, false) as Prisma.turmasUncheckedCreateInput;
  const turma = await prisma.turmas.create({ data: { ...dados, user_id: auth.user.id }, include: comContagens });
  return toRow(turma);
}

export async function updateTurma(auth: SessionUser, id: string, body: unknown): Promise<TurmaRow> {
  const dados = lerDados(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarEditavel(auth, id);
  return toRow(await prisma.turmas.update({ where: { id }, data: dados, include: comContagens }));
}

const turmaComAlunos = (n: number) =>
  new HttpError(409, 'TURMA_COM_ALUNOS', `A turma tem ${n} aluno(s). Mova ou exclua os alunos antes de excluir a turma.`);

/**
 * Só exclui turma vazia: no banco, apagar a turma apagaria junto os alunos dela (e as notas).
 * Vínculos de eletiva (`turma_membros`) não impedem: eles saem junto com a turma.
 */
export async function deleteTurma(auth: SessionUser, id: string): Promise<void> {
  const turma = await buscarEditavel(auth, id);
  if (turma._count.alunos > 0) throw turmaComAlunos(turma._count.alunos);
  // A condição se repete na exclusão: se um aluno entrar entre a conferência e aqui, nada é apagado.
  const { count } = await prisma.turmas.deleteMany({ where: { id, alunos: { none: {} } } });
  if (count === 0) throw turmaComAlunos(await prisma.alunos.count({ where: { turma_id: id } }));
}

// ===== Membros das turmas personalizadas (eletivas): alunos que vêm de várias turmas =====

const comAluno = {
  aluno: {
    select: {
      id: true, nome: true, numero_chamada: true, serie: true, ativo: true, turma_id: true,
      turma: { select: { nome: true, serie: true } },
    },
  },
} satisfies Prisma.turma_membrosInclude;
type MembroComAluno = Prisma.turma_membrosGetPayload<{ include: typeof comAluno }>;

/**
 * Um membro com o aluno junto (como `select('alunos:aluno_id(..., turmas(nome, serie))')`):
 * `alunos.turmas` é a turma de origem do aluno, não a eletiva.
 */
export type MembroRow = Omit<MembroComAluno, 'aluno'> & {
  alunos: Omit<MembroComAluno['aluno'], 'turma'> & { turmas: MembroComAluno['aluno']['turma'] };
};

const toMembro = ({ aluno: { turma, ...aluno }, ...m }: MembroComAluno): MembroRow => ({ ...m, alunos: { ...aluno, turmas: turma } });

/** Padrão A (vem da turma): o dono e a gestão veem os membros. Em ordem de nome do aluno. */
export async function listMembros(auth: SessionUser, id: string, ativo?: string): Promise<MembroRow[]> {
  if (ativo !== undefined && !['true', 'false'].includes(ativo)) throw invalido('"ativo" inválido. Use: true, false.');
  await buscarVisivel(auth, id);
  const membros = await prisma.turma_membros.findMany({
    where: { turma_id: id, ...(ativo !== undefined ? { aluno: { ativo: ativo === 'true' } } : {}) },
    include: comAluno,
    orderBy: { aluno: { nome: 'asc' } },
  });
  return membros.map(toMembro);
}

export const MAX_MEMBROS = 2000;

/**
 * `{ aluno_ids: [...] }`: define de uma vez quem participa da eletiva (a lista substitui a
 * anterior; `[]` esvazia). Só em turma personalizada. Os vínculos ficam no nome do dono da
 * turma, mesmo quando é o admin quem altera. Os alunos continuam na turma de origem.
 */
export async function setMembros(auth: SessionUser, id: string, body: unknown): Promise<MembroRow[]> {
  const alunoIds = (body as { aluno_ids?: unknown } | undefined)?.aluno_ids;
  if (!Array.isArray(alunoIds) || alunoIds.some((a) => typeof a !== 'string')) {
    throw invalido('Envie "aluno_ids" com a lista de alunos (pode ser vazia).');
  }
  const ids = [...new Set(alunoIds as string[])];
  if (ids.length > MAX_MEMBROS) throw invalido(`No máximo ${MAX_MEMBROS} alunos.`);

  const turma = await buscarEditavel(auth, id);
  if (turma.tipo !== 'personalizada') {
    throw new HttpError(400, 'TURMA_NAO_PERSONALIZADA', 'Só turmas personalizadas (eletivas) têm membros escolhidos.');
  }
  const existentes = ids.every(isUuid) ? await prisma.alunos.count({ where: { id: { in: ids } } }) : -1;
  if (existentes !== ids.length) throw new HttpError(400, 'ALUNO_INVALIDO', 'Um dos alunos informados não existe.');

  // Turma sem dono (conta apagada) só o admin altera; os vínculos ficam no nome dele.
  const dono = turma.user_id ?? auth.user.id;
  await prisma.$transaction([
    prisma.turma_membros.deleteMany({ where: { turma_id: id, aluno_id: { notIn: ids } } }),
    prisma.turma_membros.createMany({
      data: ids.map((aluno_id) => ({ turma_id: id, aluno_id, user_id: dono })),
      skipDuplicates: true,
    }),
  ]);
  return listMembros(auth, id);
}
