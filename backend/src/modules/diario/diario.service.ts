import { Prisma, type diario_atividades, type diario_lancamentos, type diario_observacoes_aluno } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeEscrever, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, bimestreDaQuery, listaDeIds } from '../avaliacoes/avaliacoes.service';

// ===== Diário de classe: atividades (colunas), lançamentos (células) e observação por aluno =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const atividadeNaoEncontrada = () => new HttpError(404, 'ATIVIDADE_NAO_ENCONTRADA', 'Atividade não encontrada.');

/** `nota` (número) ou `conceito` (texto livre, como "MB"). */
export const TIPOS = ['nota', 'conceito'];
export const MAX_LANCAMENTOS = 2000;
/** O que cabe numa célula (o professor cola do Excel: "8,5", "MB", "F"…). */
const MAX_VALOR = 30;

export type AtividadeRow = Omit<diario_atividades, 'peso' | 'data'> & { peso: number | null; data: string | null };
const toAtividade = ({ peso, data, ...a }: diario_atividades): AtividadeRow => ({
  ...a,
  peso: peso === null ? null : peso.toNumber(),
  data: data?.toISOString().slice(0, 10) ?? null,
});

function lerPeso(body: unknown): Prisma.Decimal | undefined {
  const value = (body as Record<string, unknown> | undefined)?.peso;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !(value > 0) || value > 999) throw invalido('O campo "peso" deve ser um número maior que zero.');
  return new Prisma.Decimal(value.toFixed(2));
}

function lerAtividade(body: unknown, parcial: boolean) {
  const turma_id = optionalString(body, 'turma_id');
  if (!parcial && !turma_id) throw invalido('O campo "turma_id" é obrigatório.');
  const categoria = optionalString(body, 'categoria');
  if (categoria && categoria.length > 100) throw invalido('"categoria" muito longa.');
  return {
    nome: requiredText(body, 'nome', parcial),
    turma_id: turma_id ?? undefined,
    disciplina_id: optionalString(body, 'disciplina_id'),
    bimestre: optionalInt(body, 'bimestre', 1, 4) ?? undefined,
    tipo: optionalChoice(body, 'tipo', TIPOS),
    data: optionalDate(body, 'data'),
    peso: lerPeso(body),
    observacao: optionalString(body, 'observacao'),
    categoria,
    ordem: optionalInt(body, 'ordem', 0, 1000) ?? undefined,
  };
}

async function buscarAtividadeEditavel(auth: SessionUser, id: string) {
  const a = await prisma.diario_atividades.findUnique({ where: { id } });
  if (!a) throw atividadeNaoEncontrada();
  exigirEscrita(auth, a.user_id, atividadeNaoEncontrada, 'Só o professor dono do diário pode alterá-lo.');
  return a;
}

/** Padrão A. Filtros da tela: turma, matéria e bimestre. Na ordem das colunas. */
export async function listAtividades(auth: SessionUser, f: { turma_id?: string; disciplina_id?: string; bimestre?: string }) {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  const lista = await prisma.diario_atividades.findMany({
    where: { ...filtroLeitura(auth), ...(turma_id ? { turma_id } : {}), ...(disciplina_id ? { disciplina_id } : {}), ...(bimestre ? { bimestre } : {}) },
    orderBy: [{ ordem: 'asc' }, { created_at: 'asc' }],
  });
  return lista.map(toAtividade);
}

/** `{ nome, turma_id, disciplina_id?, bimestre?, tipo?, data?, peso?, categoria?, observacao? }`. Vai para o fim. */
export async function createAtividade(auth: SessionUser, body: unknown): Promise<AtividadeRow> {
  const dados = lerAtividade(body, false);
  await assertTurmaEDisciplina(auth, dados.turma_id, dados.disciplina_id ?? undefined);
  const bimestre = dados.bimestre ?? 1;
  const ordem =
    dados.ordem ??
    (await prisma.diario_atividades.count({
      where: { user_id: auth.user.id, turma_id: dados.turma_id, disciplina_id: dados.disciplina_id ?? null, bimestre },
    }));
  const atividade = await prisma.diario_atividades.create({
    data: { ...dados, nome: dados.nome!, turma_id: dados.turma_id!, bimestre, ordem, user_id: auth.user.id },
  });
  return toAtividade(atividade);
}

/** Altera só o enviado. Turma e matéria não mudam: os lançamentos são de alunos daquela turma. */
export async function updateAtividade(auth: SessionUser, id: string, body: unknown): Promise<AtividadeRow> {
  const dados = lerAtividade(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  if (dados.turma_id !== undefined || dados.disciplina_id !== undefined) {
    throw invalido('A turma e a matéria de uma atividade não mudam. Crie uma nova atividade.');
  }
  await buscarAtividadeEditavel(auth, id);
  return toAtividade(await prisma.diario_atividades.update({ where: { id }, data: dados }));
}

/** Os lançamentos dela saem junto (a tela já avisa). */
export async function deleteAtividade(auth: SessionUser, id: string): Promise<void> {
  await buscarAtividadeEditavel(auth, id);
  await prisma.diario_atividades.delete({ where: { id } });
}

/** `{ ids: [...] }`: nova ordem das colunas (0, 1, 2…), numa operação só. */
export async function reordenarAtividades(auth: SessionUser, body: unknown): Promise<AtividadeRow[]> {
  const ids = (body as { ids?: unknown } | undefined)?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || !isUuid(i)) || new Set(ids).size !== ids.length) {
    throw invalido('Envie "ids" com as atividades na nova ordem, sem repetir.');
  }
  if (ids.length > 200) throw invalido('No máximo 200 atividades.');
  const atividades = await prisma.diario_atividades.findMany({ where: { id: { in: ids as string[] } } });
  if (atividades.length !== ids.length) throw atividadeNaoEncontrada();
  for (const a of atividades) exigirEscrita(auth, a.user_id, atividadeNaoEncontrada, 'Só o professor dono do diário pode alterá-lo.');
  const lista = await prisma.$transaction((ids as string[]).map((id, i) => prisma.diario_atividades.update({ where: { id }, data: { ordem: i } })));
  return lista.map(toAtividade);
}

// ===== Lançamentos: uma célula por aluno em cada atividade =====

/** Padrão A. Filtros: atividades e alunos (um ou vários). */
export async function listLancamentos(auth: SessionUser, f: { atividade_id?: string | string[]; aluno_id?: string | string[] }): Promise<diario_lancamentos[]> {
  const atividades = listaDeIds(f.atividade_id, 'atividade_id');
  const alunos = listaDeIds(f.aluno_id, 'aluno_id', MAX_LANCAMENTOS);
  return prisma.diario_lancamentos.findMany({
    where: {
      ...filtroLeitura(auth),
      ...(atividades.length ? { atividade_id: { in: atividades } } : {}),
      ...(alunos.length ? { aluno_id: { in: alunos } } : {}),
    },
    orderBy: { created_at: 'asc' },
  });
}

interface Lancamento {
  atividade_id: string;
  aluno_id: string;
  valor: string | null;
  fez?: boolean | null;
  observacao?: string | null;
}

function lerLancamentos(body: unknown): Lancamento[] {
  const lista = (body as { lancamentos?: unknown } | undefined)?.lancamentos;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie "lancamentos" com pelo menos uma célula.');
  if (lista.length > MAX_LANCAMENTOS) throw invalido(`No máximo ${MAX_LANCAMENTOS} células por vez.`);
  const vistos = new Set<string>();
  return lista.map((item: unknown, i) => {
    const l = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const onde = `Célula ${i + 1}`;
    if (typeof l.atividade_id !== 'string' || !isUuid(l.atividade_id)) throw invalido(`${onde}: "atividade_id" inválido.`);
    if (typeof l.aluno_id !== 'string' || !isUuid(l.aluno_id)) throw invalido(`${onde}: "aluno_id" inválido.`);
    if (l.valor !== null && typeof l.valor !== 'string') throw invalido(`${onde}: "valor" deve ser um texto (ou null para apagar).`);
    const valor = typeof l.valor === 'string' ? l.valor.trim() : null;
    if (valor && valor.length > MAX_VALOR) throw invalido(`${onde}: o valor passa de ${MAX_VALOR} caracteres.`);
    if (l.fez !== undefined && l.fez !== null && typeof l.fez !== 'boolean') throw invalido(`${onde}: "fez" deve ser verdadeiro ou falso.`);
    if (l.observacao !== undefined && l.observacao !== null && typeof l.observacao !== 'string') throw invalido(`${onde}: "observacao" deve ser um texto.`);
    const chave = `${l.atividade_id}|${l.aluno_id}`;
    if (vistos.has(chave)) throw invalido(`${onde}: o mesmo aluno aparece duas vezes na mesma atividade.`);
    vistos.add(chave);
    return {
      atividade_id: l.atividade_id,
      aluno_id: l.aluno_id,
      valor: valor || null,
      fez: l.fez as boolean | null | undefined,
      observacao: l.observacao as string | null | undefined,
    };
  });
}

/**
 * `{ lancamentos: [{ atividade_id, aluno_id, valor, fez?, observacao? }] }`: salva uma ou várias
 * células (inclusive o que foi colado do Excel). Célula vazia, sem "fez" nem observação, apaga.
 * O dono vem da atividade; o aluno precisa ser da turma dela (ou membro da eletiva). Ou tudo, ou nada.
 */
export async function lancar(auth: SessionUser, body: unknown): Promise<{ salvos: diario_lancamentos[]; apagados: number }> {
  const lancamentos = lerLancamentos(body);
  const ativIds = [...new Set(lancamentos.map((l) => l.atividade_id))];
  const atividades = new Map((await prisma.diario_atividades.findMany({ where: { id: { in: ativIds } } })).map((a) => [a.id, a]));
  for (const id of ativIds) {
    const a = atividades.get(id);
    if (!a || !podeLer(auth, a.user_id)) throw atividadeNaoEncontrada();
    if (!podeEscrever(auth, a.user_id)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só o professor dono do diário faz os lançamentos.');
  }

  const alunoIds = [...new Set(lancamentos.map((l) => l.aluno_id))];
  const [alunos, membros] = await Promise.all([
    prisma.alunos.findMany({ where: { id: { in: alunoIds } }, select: { id: true, turma_id: true } }),
    prisma.turma_membros.findMany({ where: { aluno_id: { in: alunoIds } }, select: { aluno_id: true, turma_id: true } }),
  ]);
  const turmaDe = new Map(alunos.map((a) => [a.id, a.turma_id]));
  const membro = new Set(membros.map((m) => `${m.aluno_id}|${m.turma_id}`));
  lancamentos.forEach((l, i) => {
    const turma = atividades.get(l.atividade_id)!.turma_id;
    if (!turmaDe.has(l.aluno_id)) throw new HttpError(400, 'ALUNO_INVALIDO', `Célula ${i + 1}: o aluno não existe.`);
    if (turmaDe.get(l.aluno_id) !== turma && !membro.has(`${l.aluno_id}|${turma}`)) {
      throw new HttpError(400, 'ALUNO_FORA_DA_TURMA', `Célula ${i + 1}: o aluno não é da turma desta atividade.`);
    }
  });

  const vazia = (l: Lancamento) => l.valor === null && (l.fez === undefined || l.fez === null) && !l.observacao;
  const salvar = lancamentos.filter((l) => !vazia(l));
  const apagar = lancamentos.filter(vazia);
  const resultado = await prisma.$transaction([
    ...salvar.map((l) => {
      const dados = {
        valor: l.valor,
        user_id: atividades.get(l.atividade_id)!.user_id,
        ...(l.fez !== undefined ? { fez: l.fez } : {}),
        ...(l.observacao !== undefined ? { observacao: l.observacao } : {}),
      };
      return prisma.diario_lancamentos.upsert({
        where: { atividade_id_aluno_id: { atividade_id: l.atividade_id, aluno_id: l.aluno_id } },
        create: { atividade_id: l.atividade_id, aluno_id: l.aluno_id, ...dados },
        update: dados,
      });
    }),
    ...(apagar.length
      ? [prisma.diario_lancamentos.deleteMany({ where: { OR: apagar.map((l) => ({ atividade_id: l.atividade_id, aluno_id: l.aluno_id })) } })]
      : []),
  ]);
  const apagados = apagar.length ? (resultado.at(-1) as Prisma.BatchPayload).count : 0;
  return { salvos: resultado.slice(0, salvar.length) as diario_lancamentos[], apagados };
}

// ===== Observação do aluno no bimestre (uma por aluno, turma, matéria e bimestre) =====

/** Padrão A. Filtros: turma, matéria, bimestre e alunos. */
export async function listObservacoes(
  auth: SessionUser,
  f: { turma_id?: string; disciplina_id?: string; bimestre?: string; aluno_id?: string | string[] },
): Promise<diario_observacoes_aluno[]> {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const alunos = listaDeIds(f.aluno_id, 'aluno_id', MAX_LANCAMENTOS);
  const bimestre = bimestreDaQuery(f.bimestre);
  return prisma.diario_observacoes_aluno.findMany({
    where: {
      ...filtroLeitura(auth),
      ...(turma_id ? { turma_id } : {}),
      ...(disciplina_id ? { disciplina_id } : {}),
      ...(bimestre ? { bimestre } : {}),
      ...(alunos.length ? { aluno_id: { in: alunos } } : {}),
    },
    orderBy: { created_at: 'asc' },
  });
}

/**
 * `{ aluno_id, turma_id, disciplina_id?, bimestre, observacao }`: grava ou corrige a observação do
 * aluno. Texto vazio apaga. O dono é o professor dono da matéria (ou da turma, sem matéria).
 */
export async function salvarObservacao(auth: SessionUser, body: unknown): Promise<diario_observacoes_aluno | null> {
  const aluno_id = optionalString(body, 'aluno_id');
  const turma_id = optionalString(body, 'turma_id');
  const disciplina_id = optionalString(body, 'disciplina_id') ?? null;
  const bimestre = optionalInt(body, 'bimestre', 1, 4);
  const observacao = optionalString(body, 'observacao');
  if (!aluno_id || !isUuid(aluno_id)) throw invalido('O campo "aluno_id" é obrigatório.');
  if (!turma_id) throw invalido('O campo "turma_id" é obrigatório.');
  if (!bimestre) throw invalido('O campo "bimestre" é obrigatório.');
  if (observacao === undefined) throw invalido('O campo "observacao" é obrigatório (vazio apaga).');
  await assertTurmaEDisciplina(auth, turma_id, disciplina_id ?? undefined);

  const dono = disciplina_id
    ? (await prisma.disciplinas.findUniqueOrThrow({ where: { id: disciplina_id }, select: { user_id: true } })).user_id
    : (await prisma.turmas.findUniqueOrThrow({ where: { id: turma_id }, select: { user_id: true } })).user_id;
  if (!dono || !podeEscrever(auth, dono)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só o professor dono do diário escreve as observações.');

  const aluno = await prisma.alunos.findUnique({ where: { id: aluno_id }, select: { turma_id: true } });
  if (!aluno) throw new HttpError(400, 'ALUNO_INVALIDO', 'O aluno não existe.');
  if (aluno.turma_id !== turma_id && !(await prisma.turma_membros.findFirst({ where: { turma_id, aluno_id } }))) {
    throw new HttpError(400, 'ALUNO_FORA_DA_TURMA', 'O aluno não é desta turma.');
  }

  const chave = { user_id: dono, aluno_id, turma_id, disciplina_id, bimestre };
  const existente = await prisma.diario_observacoes_aluno.findFirst({ where: chave });
  if (!observacao) {
    if (existente) await prisma.diario_observacoes_aluno.delete({ where: { id: existente.id } });
    return null;
  }
  return existente
    ? prisma.diario_observacoes_aluno.update({ where: { id: existente.id }, data: { observacao } })
    : prisma.diario_observacoes_aluno.create({ data: { ...chave, observacao } });
}
