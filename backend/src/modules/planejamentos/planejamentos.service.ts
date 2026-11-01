import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { optionalInt, optionalString } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import { isGestao } from '../../middlewares/roles';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, bimestreDaQuery, listaDeIds } from '../avaliacoes/avaliacoes.service';

// ===== Planejamento bimestral: a planilha de aulas do bimestre, validada pela gestão =====

export const planejamentoNaoEncontrado = () => new HttpError(404, 'PLANEJAMENTO_NAO_ENCONTRADO', 'Planejamento não encontrado.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);

export const STATUS = ['rascunho', 'aguardando_validacao', 'validado'] as const;
type Status = (typeof STATUS)[number];

const comTurmaEDisciplina = {
  turma: { select: { nome: true, serie: true } },
  disciplina: { select: { nome: true } },
} satisfies Prisma.planejamentos_bimestraisInclude;
type PlanejamentoComDados = Prisma.planejamentos_bimestraisGetPayload<{ include: typeof comTurmaEDisciplina }>;

export type PlanejamentoRow = Omit<PlanejamentoComDados, 'turma' | 'disciplina'> & {
  turmas: PlanejamentoComDados['turma'];
  disciplinas: PlanejamentoComDados['disciplina'];
};
const toRow = ({ turma, disciplina, ...p }: PlanejamentoComDados): PlanejamentoRow => ({ ...p, turmas: turma, disciplinas: disciplina });

const anoAtual = () => new Date().getFullYear();

function anoDaQuery(valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw invalido('"ano" inválido.');
  return n;
}

/** Padrão A. Filtros da tela: bimestre, ano, turma, matéria e professor. */
export async function listPlanejamentos(
  auth: SessionUser,
  f: { bimestre?: string; ano?: string; turma_id?: string; disciplina_id?: string; user_id?: string },
): Promise<PlanejamentoRow[]> {
  const bimestre = bimestreDaQuery(f.bimestre);
  const ano = anoDaQuery(f.ano);
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  const lista = await prisma.planejamentos_bimestrais.findMany({
    where: {
      // O filtro de professor não amplia o que o professor vê: os dois valem juntos.
      AND: [filtroLeitura(auth), user_id ? { user_id } : {}],
      ...(bimestre ? { bimestre } : {}),
      ...(ano ? { ano } : {}),
      ...(turma_id ? { turma_id } : {}),
      ...(disciplina_id ? { disciplina_id } : {}),
    },
    include: comTurmaEDisciplina,
    orderBy: [{ ano: 'desc' }, { bimestre: 'asc' }, { created_at: 'asc' }],
  });
  return lista.map(toRow);
}

export async function buscarPlanejamento(auth: SessionUser, id: string) {
  const p = await prisma.planejamentos_bimestrais.findUnique({ where: { id } });
  if (!p || !podeLer(auth, p.user_id)) throw planejamentoNaoEncontrado();
  return p;
}

export async function getPlanejamento(auth: SessionUser, id: string): Promise<PlanejamentoRow> {
  await buscarPlanejamento(auth, id);
  return toRow(await prisma.planejamentos_bimestrais.findUniqueOrThrow({ where: { id }, include: comTurmaEDisciplina }));
}

/**
 * `{ turma_id, disciplina_id?, bimestre, ano? }`: abre o planejamento de quem pede. Se já existe um
 * para a mesma turma, matéria, bimestre e ano, devolve esse (200) em vez de criar outro (201).
 */
export async function abrirPlanejamento(auth: SessionUser, body: unknown): Promise<{ criado: boolean; planejamento: PlanejamentoRow }> {
  const turma_id = optionalString(body, 'turma_id');
  const disciplina_id = optionalString(body, 'disciplina_id') ?? null;
  const bimestre = optionalInt(body, 'bimestre', 1, 4);
  const ano = optionalInt(body, 'ano', 2000, 2100) ?? anoAtual();
  if (!turma_id) throw invalido('O campo "turma_id" é obrigatório.');
  if (!bimestre) throw invalido('O campo "bimestre" é obrigatório.');
  await assertTurmaEDisciplina(auth, turma_id, disciplina_id ?? undefined);

  const chave = { user_id: auth.user.id, turma_id, disciplina_id, bimestre, ano };
  // Sem matéria, o banco aceitaria duplicatas (NULL não conflita): por isso procura antes.
  const existente = await prisma.planejamentos_bimestrais.findFirst({ where: chave, include: comTurmaEDisciplina });
  if (existente) return { criado: false, planejamento: toRow(existente) };
  const criado = await prisma.planejamentos_bimestrais.create({ data: { ...chave, status: 'rascunho' }, include: comTurmaEDisciplina });
  return { criado: true, planejamento: toRow(criado) };
}

/**
 * Exclui o planejamento (as aulas continuam existindo, só ficam fora dele). Validado não sai:
 * a gestão precisa reabrir antes.
 */
export async function deletePlanejamento(auth: SessionUser, id: string): Promise<void> {
  const p = await prisma.planejamentos_bimestrais.findUnique({ where: { id } });
  if (!p) throw planejamentoNaoEncontrado();
  exigirEscrita(auth, p.user_id, planejamentoNaoEncontrado, 'Só o professor dono pode excluir o planejamento.');
  if (p.status === 'validado') throw new HttpError(409, 'PLANEJAMENTO_VALIDADO', 'Planejamento validado não pode ser excluído. A gestão precisa reabri-lo antes.');
  await prisma.planejamentos_bimestrais.delete({ where: { id } });
}

/**
 * As mudanças de situação que a tela oferece:
 * - o dono (ou o admin) envia o rascunho para validação;
 * - a gestão valida (do rascunho ou de "aguardando"), pede ajustes (volta a rascunho) ou reabre um validado.
 */
const TRANSICOES: { de: Status[]; para: Status; quem: 'dono' | 'gestao' }[] = [
  { de: ['rascunho'], para: 'aguardando_validacao', quem: 'dono' },
  { de: ['rascunho', 'aguardando_validacao'], para: 'validado', quem: 'gestao' },
  { de: ['aguardando_validacao', 'validado'], para: 'rascunho', quem: 'gestao' },
];

/** `{ status, observacao? }`. Validar grava quem validou e quando; voltar a rascunho limpa isso. */
export async function mudarStatus(auth: SessionUser, id: string, body: unknown): Promise<PlanejamentoRow> {
  const status = optionalString(body, 'status');
  if (!status || !(STATUS as readonly string[]).includes(status)) throw invalido(`"status" deve ser ${STATUS.join(', ')}.`);
  const observacao = optionalString(body, 'observacao');
  const p = await buscarPlanejamento(auth, id);

  const transicao = TRANSICOES.find((t) => t.para === status && t.de.includes(p.status as Status));
  if (!transicao) {
    throw new HttpError(409, 'STATUS_INVALIDO', `Não dá para passar de "${p.status}" para "${status}".`);
  }
  const pode =
    transicao.quem === 'gestao' ? isGestao(auth.role) : auth.role === 'admin' || p.user_id === auth.user.id;
  if (!pode) {
    throw new HttpError(
      403,
      'SEM_PERMISSAO',
      transicao.quem === 'gestao' ? 'Só a gestão valida, pede ajustes ou reabre o planejamento.' : 'Só o professor dono envia o planejamento para validação.',
    );
  }

  const data: Prisma.planejamentos_bimestraisUncheckedUpdateInput =
    status === 'validado'
      ? { status, validado_por: auth.user.id, validado_em: new Date(), observacao_validacao: observacao ?? null }
      : { status, validado_por: null, validado_em: null, ...(observacao !== undefined ? { observacao_validacao: observacao } : {}) };
  return toRow(await prisma.planejamentos_bimestrais.update({ where: { id }, data, include: comTurmaEDisciplina }));
}
