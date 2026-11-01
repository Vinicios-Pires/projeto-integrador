import type { lembretes } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { optionalBoolean, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina } from '../avaliacoes/avaliacoes.service';

// ===== Lembretes: os post-its do painel. São pessoais: cada um vê e mexe só nos seus. =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const lembreteNaoEncontrado = () => new HttpError(404, 'LEMBRETE_NAO_ENCONTRADO', 'Lembrete não encontrado.');

export const PRIORIDADES = ['baixa', 'media', 'alta'];
/** As cores do quadro de post-its. */
export const CORES = ['amarelo', 'verde', 'azul', 'rosa', 'laranja', 'roxo'];

export type LembreteRow = Omit<lembretes, 'data'> & { data: string | null };
const toRow = (l: lembretes): LembreteRow => ({ ...l, data: l.data?.toISOString().slice(0, 10) ?? null });

function lerLembrete(body: unknown, parcial: boolean) {
  return {
    titulo: requiredText(body, 'titulo', parcial),
    descricao: optionalString(body, 'descricao'),
    data: optionalDate(body, 'data'),
    prioridade: optionalChoice(body, 'prioridade', PRIORIDADES),
    cor: optionalChoice(body, 'cor', CORES),
    turma_id: optionalString(body, 'turma_id'),
    disciplina_id: optionalString(body, 'disciplina_id'),
    concluido: optionalBoolean(body, 'concluido'),
    fixado: optionalBoolean(body, 'fixado'),
    posicao: optionalInt(body, 'posicao', 0, 100_000) ?? undefined,
  };
}

/** Só os próprios: fixados primeiro, depois os mais novos. */
export async function listLembretes(auth: SessionUser): Promise<LembreteRow[]> {
  const lista = await prisma.lembretes.findMany({
    where: { user_id: auth.user.id },
    orderBy: [{ fixado: 'desc' }, { created_at: 'desc' }],
  });
  return lista.map(toRow);
}

/** `{ titulo, descricao?, data?, prioridade?, cor?, turma_id?, disciplina_id?, fixado? }`. */
export async function createLembrete(auth: SessionUser, body: unknown): Promise<LembreteRow> {
  const dados = lerLembrete(body, false);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  return toRow(await prisma.lembretes.create({ data: { ...dados, titulo: dados.titulo!, user_id: auth.user.id } }));
}

/** Altera só o enviado (marcar como feito, fixar, mudar a cor…). De outra pessoa, nem existe. */
export async function updateLembrete(auth: SessionUser, id: string, body: unknown): Promise<LembreteRow> {
  const dados = lerLembrete(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  if (!(await prisma.lembretes.findFirst({ where: { id, user_id: auth.user.id } }))) throw lembreteNaoEncontrado();
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  return toRow(await prisma.lembretes.update({ where: { id }, data: dados }));
}

export async function deleteLembrete(auth: SessionUser, id: string): Promise<void> {
  const { count } = await prisma.lembretes.deleteMany({ where: { id, user_id: auth.user.id } });
  if (!count) throw lembreteNaoEncontrado();
}
