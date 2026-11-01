import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// A conta da correção, usada ao lançar respostas e ao mudar o gabarito ou a prova.

export type Respostas = Record<string, string>;
export type Gabarito = Map<number, { resposta_correta: string; anulada: boolean | null }>;

/**
 * A mesma conta da tela: a questão anulada vale acerto para todos; a nota é a fração de acertos
 * sobre o número de questões, vezes o valor da prova (2 casas).
 */
export function corrigir(respostas: Respostas, gabarito: Gabarito, numeroQuestoes: number, valorTotal: number) {
  let acertos = 0;
  for (let q = 1; q <= numeroQuestoes; q++) {
    const g = gabarito.get(q);
    if (g?.anulada || (g && respostas[q] === g.resposta_correta)) acertos++;
  }
  const nota = numeroQuestoes > 0 ? Math.round((acertos / numeroQuestoes) * valorTotal * 100) / 100 : 0;
  return { acertos, nota };
}

export async function gabaritoDaProva(prova_id: string, db: Prisma.TransactionClient = prisma) {
  const gabarito: Gabarito = new Map(
    (await db.gabaritos.findMany({ where: { prova_id } })).map((g) => [g.numero_questao, { resposta_correta: g.resposta_correta, anulada: g.anulada }]),
  );
  return gabarito;
}

/**
 * Recalcula acertos e nota das correções automáticas (as ajustadas à mão ficam como estão).
 * Chamado quando o gabarito, o número de questões ou o valor da prova mudam.
 */
export async function recalcularResultados(prova_id: string, db: Prisma.TransactionClient) {
  const prova = await db.provas.findUniqueOrThrow({ where: { id: prova_id } });
  const gabarito = await gabaritoDaProva(prova_id, db);
  const resultados = await db.resultados_prova.findMany({ where: { prova_id, OR: [{ ajuste_manual: false }, { ajuste_manual: null }] } });
  for (const r of resultados) {
    const { acertos, nota } = corrigir((r.respostas ?? {}) as Respostas, gabarito, prova.numero_questoes, prova.valor_total?.toNumber() ?? 10);
    await db.resultados_prova.update({ where: { id: r.id }, data: { acertos, nota: new Prisma.Decimal(nota.toFixed(2)) } });
  }
}
