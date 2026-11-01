import type { agenda_excecoes, agenda_professor, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalDate } from '../../lib/body';
import { exigirEscrita, podeLer } from '../../lib/acesso';
import { isGestao } from '../../middlewares/roles';
import type { SessionUser } from '../auth/auth.service';
import { listaDeIds } from '../avaliacoes/avaliacoes.service';

// ===== Agenda do professor: a rotina da semana e as exceções de cada dia =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const itemNaoEncontrado = () => new HttpError(404, 'AGENDA_NAO_ENCONTRADA', 'Item da agenda não encontrado.');
export const MAX_ITENS = 400;
const dia = (d: Date) => d.toISOString().slice(0, 10);

export type ExcecaoRow = Omit<agenda_excecoes, 'data'> & { data: string };
const toExcecao = (e: agenda_excecoes): ExcecaoRow => ({ ...e, data: dia(e.data) });

/**
 * De quem é a agenda pedida: a própria, ou (para a gestão) a de outro professor (`user_id`).
 * O professor que pede a de outro recebe 404, como nos outros módulos.
 */
function donoDaConsulta(auth: SessionUser, user_id: string | undefined): string {
  const [id] = listaDeIds(user_id, 'user_id', 1);
  if (!id || id === auth.user.id) return auth.user.id;
  if (!isGestao(auth.role)) throw itemNaoEncontrado();
  return id;
}

/** Os campos de conteúdo de um item (rotina ou exceção). */
function lerConteudo(l: Record<string, unknown>, onde: string) {
  const texto = (campo: string, max: number) => {
    const v = l[campo];
    if (v === undefined || v === null || v === '') return v === undefined ? undefined : null;
    if (typeof v !== 'string' || v.length > max) throw invalido(`${onde}: "${campo}" deve ser um texto de até ${max} caracteres.`);
    return v.trim();
  };
  const id = (campo: string) => {
    const v = l[campo];
    if (v === undefined || v === null || v === '') return v === undefined ? undefined : null;
    if (typeof v !== 'string' || !isUuid(v)) throw invalido(`${onde}: "${campo}" inválido.`);
    return v;
  };
  if (typeof l.horario_grade_id !== 'string' || !isUuid(l.horario_grade_id)) throw invalido(`${onde}: "horario_grade_id" inválido.`);
  return {
    horario_grade_id: l.horario_grade_id,
    disciplina_id: id('disciplina_id'),
    turma_id: id('turma_id'),
    atividade: texto('atividade', 200),
  };
}

/** Horários da grade, turmas e matérias usados precisam existir (turma e matéria, visíveis para quem grava). */
async function assertReferencias(auth: SessionUser, itens: { horario_grade_id: string; turma_id?: string | null; disciplina_id?: string | null }[]) {
  const horarios = [...new Set(itens.map((i) => i.horario_grade_id))];
  if ((await prisma.horario_grade.count({ where: { id: { in: horarios } } })) !== horarios.length) {
    throw new HttpError(400, 'HORARIO_INVALIDO', 'Um dos horários da grade não existe.');
  }
  const turmas = [...new Set(itens.map((i) => i.turma_id).filter((t): t is string => !!t))];
  const visiveis = await prisma.turmas.findMany({ where: { id: { in: turmas } }, select: { user_id: true } });
  if (visiveis.length !== turmas.length || visiveis.some((t) => !podeLer(auth, t.user_id))) {
    throw new HttpError(400, 'TURMA_INVALIDA', 'Uma das turmas informadas não existe.');
  }
  const disciplinas = [...new Set(itens.map((i) => i.disciplina_id).filter((d): d is string => !!d))];
  const ds = await prisma.disciplinas.findMany({ where: { id: { in: disciplinas } }, select: { user_id: true } });
  if (ds.length !== disciplinas.length || ds.some((d) => !podeLer(auth, d.user_id))) {
    throw new HttpError(400, 'DISCIPLINA_INVALIDA', 'Uma das matérias informadas não existe.');
  }
}

function lerLista(body: unknown): Record<string, unknown>[] {
  const lista = (body as { itens?: unknown } | undefined)?.itens;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie "itens" com pelo menos um item.');
  if (lista.length > MAX_ITENS) throw invalido(`No máximo ${MAX_ITENS} itens por vez.`);
  return lista.map((item) => (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>);
}

// ----- Rotina da semana -----

/** A rotina de quem pede (a gestão pode pedir a de um professor com `user_id`). */
export async function listRotina(auth: SessionUser, user_id?: string): Promise<agenda_professor[]> {
  const dono = donoDaConsulta(auth, user_id);
  return prisma.agenda_professor.findMany({ where: { user_id: dono }, orderBy: [{ dia_semana: 'asc' }, { created_at: 'asc' }] });
}

/**
 * `{ itens: [{ dia_semana (0 = domingo … 6), horario_grade_id, turma_id?, disciplina_id?, atividade?, cor? }] }`:
 * grava ou corrige a rotina (um item por dia da semana e horário). Serve para uma célula e para
 * "replicar a segunda para a semana". Sempre na agenda de quem pede. Ou tudo, ou nada.
 */
export async function salvarRotina(auth: SessionUser, body: unknown): Promise<agenda_professor[]> {
  const vistos = new Set<string>();
  const itens = lerLista(body).map((l, i) => {
    const onde = `Item ${i + 1}`;
    const d = l.dia_semana;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) throw invalido(`${onde}: "dia_semana" deve ser de 0 (domingo) a 6 (sábado).`);
    const conteudo = lerConteudo(l, onde);
    if (l.cor !== undefined && l.cor !== null && (typeof l.cor !== 'string' || l.cor.length > 30)) throw invalido(`${onde}: "cor" inválida.`);
    const chave = `${d}|${conteudo.horario_grade_id}`;
    if (vistos.has(chave)) throw invalido(`${onde}: o mesmo dia e horário aparece duas vezes.`);
    vistos.add(chave);
    return { dia_semana: d, ...conteudo, ...(l.cor !== undefined ? { cor: (l.cor as string | null) || null } : {}) };
  });
  await assertReferencias(auth, itens);
  const user_id = auth.user.id;
  return prisma.$transaction(
    itens.map(({ dia_semana, horario_grade_id, ...dados }) =>
      prisma.agenda_professor.upsert({
        where: { user_id_dia_semana_horario_grade_id: { user_id, dia_semana, horario_grade_id } },
        create: { user_id, dia_semana, horario_grade_id, ...dados },
        update: dados,
      }),
    ),
  );
}

/** "Limpar" uma célula da rotina. Só o dono (ou o admin). */
export async function deleteRotina(auth: SessionUser, id: string): Promise<void> {
  const item = await prisma.agenda_professor.findUnique({ where: { id }, select: { user_id: true } });
  if (!item) throw itemNaoEncontrado();
  exigirEscrita(auth, item.user_id, itemNaoEncontrado, 'Só o professor dono da agenda pode alterá-la.');
  await prisma.agenda_professor.delete({ where: { id } });
}

// ----- Exceções de um dia -----

/** As exceções de quem pede, opcionalmente num período (`de`, `ate`). */
export async function listExcecoes(auth: SessionUser, f: { user_id?: string; de?: string; ate?: string }): Promise<ExcecaoRow[]> {
  const dono = donoDaConsulta(auth, f.user_id);
  const de = f.de === undefined ? undefined : optionalDate({ de: f.de }, 'de') ?? undefined;
  const ate = f.ate === undefined ? undefined : optionalDate({ ate: f.ate }, 'ate') ?? undefined;
  const lista = await prisma.agenda_excecoes.findMany({
    where: { user_id: dono, ...(de || ate ? { data: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}) },
    orderBy: [{ data: 'asc' }, { created_at: 'asc' }],
  });
  return lista.map(toExcecao);
}

/**
 * `{ itens: [{ data, horario_grade_id, turma_id?, disciplina_id?, atividade?, cancelado?, observacao? }] }`:
 * grava ou corrige exceções (uma por data e horário). Serve para mudar uma aula num dia, cancelar
 * (`cancelado: true`) ou repetir até o fim do ano (várias datas). Ou tudo, ou nada.
 */
export async function salvarExcecoes(auth: SessionUser, body: unknown): Promise<ExcecaoRow[]> {
  const vistos = new Set<string>();
  const itens = lerLista(body).map((l, i) => {
    const onde = `Item ${i + 1}`;
    const data = optionalDate(l, 'data');
    if (!data) throw invalido(`${onde}: "data" é obrigatória (AAAA-MM-DD).`);
    const conteudo = lerConteudo(l, onde);
    if (l.cancelado !== undefined && typeof l.cancelado !== 'boolean') throw invalido(`${onde}: "cancelado" deve ser verdadeiro ou falso.`);
    if (l.observacao !== undefined && l.observacao !== null && (typeof l.observacao !== 'string' || l.observacao.length > 1000)) {
      throw invalido(`${onde}: "observacao" deve ser um texto de até 1000 caracteres.`);
    }
    const chave = `${dia(data)}|${conteudo.horario_grade_id}`;
    if (vistos.has(chave)) throw invalido(`${onde}: a mesma data e horário aparece duas vezes.`);
    vistos.add(chave);
    return {
      data,
      ...conteudo,
      cancelado: (l.cancelado as boolean | undefined) ?? false,
      ...(l.observacao !== undefined ? { observacao: (l.observacao as string | null) || null } : {}),
    };
  });
  await assertReferencias(auth, itens);
  const user_id = auth.user.id;
  const salvas = await prisma.$transaction(
    itens.map(({ data, horario_grade_id, ...dados }) =>
      prisma.agenda_excecoes.upsert({
        where: { user_id_data_horario_grade_id: { user_id, data, horario_grade_id } },
        create: { user_id, data, horario_grade_id, ...dados },
        update: dados satisfies Prisma.agenda_excecoesUncheckedUpdateInput,
      }),
    ),
  );
  return salvas.map(toExcecao);
}

/** Desfaz a exceção: o dia volta a seguir a rotina. Só o dono (ou o admin). */
export async function deleteExcecao(auth: SessionUser, id: string): Promise<void> {
  const item = await prisma.agenda_excecoes.findUnique({ where: { id }, select: { user_id: true } });
  if (!item) throw itemNaoEncontrado();
  exigirEscrita(auth, item.user_id, itemNaoEncontrado, 'Só o professor dono da agenda pode alterá-la.');
  await prisma.agenda_excecoes.delete({ where: { id } });
}
