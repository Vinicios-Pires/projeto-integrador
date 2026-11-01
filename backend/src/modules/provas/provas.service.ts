import { Prisma, type gabaritos } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, bimestreDaQuery, listaDeIds } from '../avaliacoes/avaliacoes.service';
import { recalcularResultados } from './correcao';

// ===== Provas: a prova de múltipla escolha corrigida pela tela "Correção de Provas" =====

export const provaNaoEncontrada = () => new HttpError(404, 'PROVA_NAO_ENCONTRADA', 'Prova não encontrada.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
const numero = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

/** Alternativas da folha de respostas (a tela usa A a E). */
export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'];
/** A tela permite até 60; o backend aceita um pouco mais de folga. */
export const MAX_QUESTOES = 100;

const comTurmaEDisciplina = {
  turma: { select: { nome: true, serie: true } },
  disciplina: { select: { nome: true } },
} satisfies Prisma.provasInclude;
type ProvaComDados = Prisma.provasGetPayload<{ include: typeof comTurmaEDisciplina }>;

/** Uma prova com a turma e a matéria junto (como `select('*, turmas(nome), disciplinas(nome)')`). */
export type ProvaRow = Omit<ProvaComDados, 'turma' | 'disciplina' | 'valor_total' | 'data_aplicacao'> & {
  valor_total: number | null;
  data_aplicacao: string | null;
  turmas: ProvaComDados['turma'];
  disciplinas: ProvaComDados['disciplina'];
};
const toProva = ({ turma, disciplina, valor_total, data_aplicacao, ...p }: ProvaComDados): ProvaRow => ({
  ...p,
  valor_total: numero(valor_total),
  data_aplicacao: data_aplicacao?.toISOString().slice(0, 10) ?? null,
  turmas: turma,
  disciplinas: disciplina,
});

/** Valor total da prova (pontos): maior que zero, até 2 casas. */
function lerValorTotal(body: unknown): Prisma.Decimal | undefined {
  const value = (body as Record<string, unknown> | undefined)?.valor_total;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !(value > 0) || value > 1000) throw invalido('O campo "valor_total" deve ser um número maior que zero.');
  return new Prisma.Decimal(value.toFixed(2));
}

/** Turma e matéria são opcionais (a tela deixa em branco); `null` tira. O dono é sempre quem cria. */
function lerProva(body: unknown, parcial: boolean) {
  return {
    titulo: requiredText(body, 'titulo', parcial),
    turma_id: optionalString(body, 'turma_id'),
    disciplina_id: optionalString(body, 'disciplina_id'),
    bimestre: optionalInt(body, 'bimestre', 1, 4) ?? undefined,
    numero_questoes: optionalInt(body, 'numero_questoes', 1, MAX_QUESTOES) ?? undefined,
    data_aplicacao: optionalDate(body, 'data_aplicacao'),
    observacoes: optionalString(body, 'observacoes'),
    valor_total: lerValorTotal(body),
    escola: optionalString(body, 'escola'),
    professor: optionalString(body, 'professor'),
  };
}

async function buscarProva(auth: SessionUser, id: string) {
  const prova = await prisma.provas.findUnique({ where: { id } });
  if (!prova || !podeLer(auth, prova.user_id)) throw provaNaoEncontrada();
  return prova;
}

export async function buscarProvaEditavel(auth: SessionUser, id: string) {
  const prova = await prisma.provas.findUnique({ where: { id } });
  if (!prova) throw provaNaoEncontrada();
  exigirEscrita(auth, prova.user_id, provaNaoEncontrada, 'Só o professor dono da prova pode alterá-la.');
  return prova;
}

/** Padrão A. Filtros: turma, matéria e bimestre. As mais novas primeiro, como a tela mostra. */
export async function listProvas(auth: SessionUser, f: { turma_id?: string; disciplina_id?: string; bimestre?: string }) {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  const lista = await prisma.provas.findMany({
    where: { ...filtroLeitura(auth), ...(turma_id ? { turma_id } : {}), ...(disciplina_id ? { disciplina_id } : {}), ...(bimestre ? { bimestre } : {}) },
    include: comTurmaEDisciplina,
    orderBy: { created_at: 'desc' },
  });
  return lista.map(toProva);
}

export async function getProva(auth: SessionUser, id: string): Promise<ProvaRow> {
  await buscarProva(auth, id);
  return toProva(await prisma.provas.findUniqueOrThrow({ where: { id }, include: comTurmaEDisciplina }));
}

/** `{ titulo, turma_id?, disciplina_id?, bimestre?, numero_questoes?, data_aplicacao?, valor_total?, ... }`. */
export async function createProva(auth: SessionUser, body: unknown): Promise<ProvaRow> {
  const dados = lerProva(body, false);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  const prova = await prisma.provas.create({
    data: { ...dados, titulo: dados.titulo!, user_id: auth.user.id },
    include: comTurmaEDisciplina,
  });
  return toProva(prova);
}

/**
 * Altera só o enviado. Com menos questões, o gabarito das que sobram some junto. Mudar o número
 * de questões ou o valor recalcula as notas já corrigidas. Com respostas de alunos já lançadas, a
 * turma não muda (os resultados são de alunos daquela turma).
 */
export async function updateProva(auth: SessionUser, id: string, body: unknown): Promise<ProvaRow> {
  const dados = lerProva(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const prova = await buscarProvaEditavel(auth, id);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  if (dados.turma_id !== undefined && dados.turma_id !== prova.turma_id && (await prisma.resultados_prova.count({ where: { prova_id: id } }))) {
    throw new HttpError(409, 'PROVA_COM_RESULTADOS', 'A prova já tem respostas de alunos: a turma não pode mudar.');
  }
  const atualizada = await prisma.$transaction(
    async (tx) => {
      const prova = await tx.provas.update({ where: { id }, data: dados, include: comTurmaEDisciplina });
      if (dados.numero_questoes) await tx.gabaritos.deleteMany({ where: { prova_id: id, numero_questao: { gt: dados.numero_questoes } } });
      if (dados.numero_questoes || dados.valor_total) await recalcularResultados(id, tx);
      return prova;
    },
    { timeout: 30_000 },
  );
  return toProva(atualizada);
}

/** O gabarito e as respostas dos alunos saem junto. */
export async function deleteProva(auth: SessionUser, id: string): Promise<void> {
  await buscarProvaEditavel(auth, id);
  await prisma.provas.delete({ where: { id } });
}

// ===== Gabarito: a resposta certa de cada questão =====

export type GabaritoRow = Omit<gabaritos, 'peso'> & { peso: number | null };
const toGabarito = (g: gabaritos): GabaritoRow => ({ ...g, peso: numero(g.peso) });

export async function getGabarito(auth: SessionUser, id: string): Promise<GabaritoRow[]> {
  await buscarProva(auth, id);
  const lista = await prisma.gabaritos.findMany({ where: { prova_id: id }, orderBy: { numero_questao: 'asc' } });
  return lista.map(toGabarito);
}

/**
 * `{ questoes: [{ numero_questao, resposta_correta, anulada?, peso? }] }`: salva o gabarito
 * inteiro (as questões que não vierem saem). A questão anulada conta como acerto para todos. As
 * notas já corrigidas são recalculadas (menos as ajustadas à mão).
 */
export async function salvarGabarito(auth: SessionUser, id: string, body: unknown): Promise<GabaritoRow[]> {
  const prova = await buscarProvaEditavel(auth, id);
  const lista = (body as { questoes?: unknown } | undefined)?.questoes;
  if (!Array.isArray(lista)) throw invalido('Envie "questoes" com o gabarito.');
  const vistas = new Set<number>();
  const questoes = lista.map((item: unknown, i) => {
    const q = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const onde = `Questão ${i + 1}`;
    const n = q.numero_questao;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > prova.numero_questoes) {
      throw invalido(`${onde}: "numero_questao" deve ser de 1 a ${prova.numero_questoes}.`);
    }
    if (vistas.has(n)) throw invalido(`${onde}: a questão ${n} aparece duas vezes.`);
    vistas.add(n);
    if (typeof q.resposta_correta !== 'string' || !ALTERNATIVAS.includes(q.resposta_correta)) {
      throw invalido(`${onde}: "resposta_correta" deve ser ${ALTERNATIVAS.join(', ')}.`);
    }
    if (q.anulada !== undefined && typeof q.anulada !== 'boolean') throw invalido(`${onde}: "anulada" deve ser verdadeiro ou falso.`);
    if (q.peso !== undefined && (typeof q.peso !== 'number' || !(q.peso > 0) || q.peso > 999)) {
      throw invalido(`${onde}: "peso" deve ser um número maior que zero.`);
    }
    return {
      numero_questao: n,
      resposta_correta: q.resposta_correta,
      anulada: (q.anulada as boolean | undefined) ?? false,
      peso: new Prisma.Decimal(((q.peso as number | undefined) ?? 1).toFixed(2)),
    };
  });
  await prisma.$transaction(
    async (tx) => {
      await tx.gabaritos.deleteMany({ where: { prova_id: id, numero_questao: { notIn: questoes.map((q) => q.numero_questao) } } });
      for (const q of questoes) {
        await tx.gabaritos.upsert({
          where: { prova_id_numero_questao: { prova_id: id, numero_questao: q.numero_questao } },
          create: { prova_id: id, ...q },
          update: q,
        });
      }
      await recalcularResultados(id, tx);
    },
    { timeout: 30_000 },
  );
  return getGabarito(auth, id);
}
