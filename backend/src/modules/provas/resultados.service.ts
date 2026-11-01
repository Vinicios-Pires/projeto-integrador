import { Prisma, type resultados_prova } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { exigirEscrita, podeLer } from '../../lib/acesso';
import { isUuid } from '../../lib/body';
import type { SessionUser } from '../auth/auth.service';
import { ALTERNATIVAS, provaNaoEncontrada } from './provas.service';
import { corrigir, gabaritoDaProva, type Respostas } from './correcao';

// ===== Correção: as respostas de cada aluno, os acertos e a nota =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const MAX_RESULTADOS = 500;

const comAluno = { aluno: { select: { nome: true, numero_chamada: true } } } satisfies Prisma.resultados_provaInclude;
type ResultadoComAluno = Prisma.resultados_provaGetPayload<{ include: typeof comAluno }>;

export type ResultadoRow = Omit<resultados_prova, 'nota'> & {
  nota: number | null;
  alunos: ResultadoComAluno['aluno'];
};
const toResultado = ({ aluno, ...r }: ResultadoComAluno): ResultadoRow => ({ ...r, nota: r.nota === null ? null : r.nota.toNumber(), alunos: aluno });

/** Dono e gestão veem. Com o nome e o número de chamada do aluno. */
export async function listResultados(auth: SessionUser, prova_id: string): Promise<ResultadoRow[]> {
  const prova = await prisma.provas.findUnique({ where: { id: prova_id }, select: { user_id: true } });
  if (!prova || !podeLer(auth, prova.user_id)) throw provaNaoEncontrada();
  const lista = await prisma.resultados_prova.findMany({
    where: { prova_id },
    include: comAluno,
    orderBy: [{ aluno: { numero_chamada: 'asc' } }, { aluno: { nome: 'asc' } }],
  });
  return lista.map(toResultado);
}

interface Lancamento {
  aluno_id: string;
  respostas: Respostas;
  nota?: number | null;
  observacoes?: string | null;
}

function lerLancamentos(body: unknown, numeroQuestoes: number, valorTotal: number): Lancamento[] {
  const lista = (body as { resultados?: unknown } | undefined)?.resultados;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie "resultados" com pelo menos um aluno.');
  if (lista.length > MAX_RESULTADOS) throw invalido(`No máximo ${MAX_RESULTADOS} alunos por vez.`);
  const vistos = new Set<string>();
  return lista.map((item: unknown, i) => {
    const l = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const onde = `Aluno ${i + 1}`;
    if (typeof l.aluno_id !== 'string' || !isUuid(l.aluno_id)) throw invalido(`${onde}: "aluno_id" inválido.`);
    if (vistos.has(l.aluno_id)) throw invalido(`${onde}: o mesmo aluno aparece duas vezes.`);
    vistos.add(l.aluno_id);

    const bruto = l.respostas;
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) throw invalido(`${onde}: "respostas" deve ser um objeto { "1": "A", ... }.`);
    const respostas: Respostas = {};
    for (const [chave, valor] of Object.entries(bruto)) {
      const q = Number(chave);
      if (!Number.isInteger(q) || q < 1 || q > numeroQuestoes) throw invalido(`${onde}: a prova não tem a questão "${chave}".`);
      if (valor === '' || valor === null) continue; // em branco
      if (typeof valor !== 'string' || !ALTERNATIVAS.includes(valor)) throw invalido(`${onde}: a resposta da questão ${q} deve ser ${ALTERNATIVAS.join(', ')}.`);
      respostas[String(q)] = valor;
    }

    if (l.nota !== undefined && l.nota !== null && (typeof l.nota !== 'number' || !(l.nota >= 0 && l.nota <= valorTotal))) {
      throw invalido(`${onde}: a nota deve ser de 0 a ${valorTotal} (o valor da prova).`);
    }
    if (l.observacoes !== undefined && l.observacoes !== null && typeof l.observacoes !== 'string') {
      throw invalido(`${onde}: "observacoes" deve ser um texto.`);
    }
    return { aluno_id: l.aluno_id, respostas, nota: l.nota as number | null | undefined, observacoes: l.observacoes as string | null | undefined };
  });
}

/**
 * `{ resultados: [{ aluno_id, respostas: { "1": "A", ... }, nota?, observacoes? }] }`: lança ou
 * corrige as respostas de um ou vários alunos. O backend confere com o gabarito e calcula acertos
 * e nota. Com `nota`, ela vale como ajuste manual (e não muda se o gabarito mudar); `nota: null`
 * volta ao cálculo automático. Ou entra tudo, ou nada.
 */
export async function lancarResultados(auth: SessionUser, prova_id: string, body: unknown): Promise<ResultadoRow[]> {
  const prova = await prisma.provas.findUnique({ where: { id: prova_id } });
  if (!prova) throw provaNaoEncontrada();
  exigirEscrita(auth, prova.user_id, provaNaoEncontrada, 'Só o professor dono da prova lança as respostas.');
  if (!prova.turma_id) throw new HttpError(409, 'PROVA_SEM_TURMA', 'Escolha a turma da prova antes de lançar as respostas.');
  const gabarito = await gabaritoDaProva(prova_id);
  if (gabarito.size === 0) throw new HttpError(409, 'PROVA_SEM_GABARITO', 'Salve o gabarito antes de lançar as respostas.');
  const valorTotal = prova.valor_total?.toNumber() ?? 10;
  const lancamentos = lerLancamentos(body, prova.numero_questoes, valorTotal);

  // O aluno precisa ser da turma da prova: direto ou como membro (eletiva).
  const alunoIds = lancamentos.map((l) => l.aluno_id);
  const [alunos, membros] = await Promise.all([
    prisma.alunos.findMany({ where: { id: { in: alunoIds } }, select: { id: true, turma_id: true } }),
    prisma.turma_membros.findMany({ where: { turma_id: prova.turma_id, aluno_id: { in: alunoIds } }, select: { aluno_id: true } }),
  ]);
  const turmaDe = new Map(alunos.map((a) => [a.id, a.turma_id]));
  const membro = new Set(membros.map((m) => m.aluno_id));
  alunoIds.forEach((id, i) => {
    if (!turmaDe.has(id)) throw new HttpError(400, 'ALUNO_INVALIDO', `Aluno ${i + 1}: o aluno não existe.`);
    if (turmaDe.get(id) !== prova.turma_id && !membro.has(id)) {
      throw new HttpError(400, 'ALUNO_FORA_DA_TURMA', `Aluno ${i + 1}: o aluno não é da turma desta prova.`);
    }
  });

  const salvos = await prisma.$transaction(
    lancamentos.map((l) => {
      const calculado = corrigir(l.respostas, gabarito, prova.numero_questoes, valorTotal);
      const manual = typeof l.nota === 'number';
      const dados = {
        respostas: l.respostas,
        acertos: calculado.acertos,
        nota: new Prisma.Decimal((manual ? l.nota! : calculado.nota).toFixed(2)),
        ajuste_manual: manual,
        user_id: prova.user_id,
        ...(l.observacoes !== undefined ? { observacoes: l.observacoes } : {}),
      };
      return prisma.resultados_prova.upsert({
        where: { prova_id_aluno_id: { prova_id, aluno_id: l.aluno_id } },
        create: { prova_id, aluno_id: l.aluno_id, ...dados },
        update: dados,
        include: comAluno,
      });
    }),
  );
  return salvos.map(toResultado);
}

/** Apaga a correção de um aluno (por exemplo, folha lançada no aluno errado). */
export async function deleteResultado(auth: SessionUser, prova_id: string, aluno_id: string): Promise<void> {
  const prova = await prisma.provas.findUnique({ where: { id: prova_id }, select: { user_id: true } });
  if (!prova) throw provaNaoEncontrada();
  exigirEscrita(auth, prova.user_id, provaNaoEncontrada, 'Só o professor dono da prova apaga as respostas.');
  const { count } = isUuid(aluno_id) ? await prisma.resultados_prova.deleteMany({ where: { prova_id, aluno_id } }) : { count: 0 };
  if (!count) throw new HttpError(404, 'RESULTADO_NAO_ENCONTRADO', 'Este aluno não tem respostas lançadas nesta prova.');
}
