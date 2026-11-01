import { Prisma, type notas, type tipos_avaliacao } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeEscrever, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
/** Colunas decimais saem como número (o Prisma devolveria texto; o Supabase devolve número). */
const numero = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

/** Lista de ids na query (`a,b` ou parâmetro repetido); id malformado é erro de dados. */
export function listaDeIds(valor: string | string[] | undefined, campo: string, max = 500): string[] {
  const ids = [valor ?? []].flat().flatMap((v) => v.split(',')).filter(Boolean);
  if (ids.some((id) => !isUuid(id))) throw invalido(`"${campo}" inválido.`);
  if (ids.length > max) throw invalido(`No máximo ${max} valores em "${campo}".`);
  return ids;
}

export function bimestreDaQuery(valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw invalido('"bimestre" deve ser de 1 a 4.');
  return n;
}

// ===== Tipos de avaliação: as colunas da planilha de notas (prova, trabalho…) =====

/** `normal` ou `prova_paulista` (a tela marca as avaliações da Prova Paulista). */
export const CATEGORIAS = ['normal', 'prova_paulista'];
export const tipoNaoEncontrado = () => new HttpError(404, 'AVALIACAO_NAO_ENCONTRADA', 'Avaliação não encontrada.');

export type TipoRow = Omit<tipos_avaliacao, 'peso'> & { peso: number | null };
const toTipo = (t: tipos_avaliacao): TipoRow => ({ ...t, peso: numero(t.peso) });

/** Peso positivo (ex.: 1, 0,5, 25% vira 0,25 na tela). Até 2 casas, como a coluna do banco. */
function lerPeso(body: unknown): Prisma.Decimal | undefined {
  const value = (body as Record<string, unknown> | undefined)?.peso;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !(value > 0) || value > 999) throw invalido('O campo "peso" deve ser um número maior que zero.');
  return new Prisma.Decimal(value.toFixed(2));
}

/** Turma e matéria precisam existir e estar visíveis para quem cria (as próprias; a gestão, todas). */
export async function assertTurmaEDisciplina(auth: SessionUser, turma_id: string | undefined, disciplina_id: string | undefined) {
  if (turma_id !== undefined) {
    const turma = isUuid(turma_id) ? await prisma.turmas.findUnique({ where: { id: turma_id }, select: { user_id: true } }) : null;
    if (!turma || !podeLer(auth, turma.user_id)) throw new HttpError(400, 'TURMA_INVALIDA', 'A turma informada não existe.');
  }
  if (disciplina_id !== undefined) {
    const d = isUuid(disciplina_id) ? await prisma.disciplinas.findUnique({ where: { id: disciplina_id }, select: { user_id: true } }) : null;
    if (!d || !podeLer(auth, d.user_id)) throw new HttpError(400, 'DISCIPLINA_INVALIDA', 'A matéria informada não existe.');
  }
}

function lerTipo(body: unknown, parcial: boolean) {
  const turma_id = optionalString(body, 'turma_id');
  const disciplina_id = optionalString(body, 'disciplina_id');
  const bimestre = optionalInt(body, 'bimestre', 1, 4);
  for (const [campo, valor] of Object.entries({ turma_id, disciplina_id, bimestre })) {
    if (valor === null || (valor === undefined && !parcial)) throw invalido(`O campo "${campo}" é obrigatório.`);
  }
  return {
    nome: requiredText(body, 'nome', parcial),
    descricao: optionalString(body, 'descricao'),
    peso: lerPeso(body),
    bimestre: bimestre ?? undefined,
    turma_id: turma_id ?? undefined,
    disciplina_id: disciplina_id ?? undefined,
    ordem: optionalInt(body, 'ordem', 0, 1000) ?? undefined,
    categoria: optionalChoice(body, 'categoria', CATEGORIAS),
  };
}

async function buscarTipoEditavel(auth: SessionUser, id: string): Promise<tipos_avaliacao> {
  const tipo = await prisma.tipos_avaliacao.findUnique({ where: { id } });
  if (!tipo) throw tipoNaoEncontrado();
  exigirEscrita(auth, tipo.user_id, tipoNaoEncontrado, 'Só o professor dono da avaliação pode alterá-la.');
  return tipo;
}

/** Padrão A. Filtros da tela: turma, matéria e bimestre. Na ordem das colunas. */
export async function listTipos(auth: SessionUser, f: { turma_id?: string; disciplina_id?: string; bimestre?: string }) {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  const lista = await prisma.tipos_avaliacao.findMany({
    where: { ...filtroLeitura(auth), ...(turma_id ? { turma_id } : {}), ...(disciplina_id ? { disciplina_id } : {}), ...(bimestre ? { bimestre } : {}) },
    orderBy: [{ ordem: 'asc' }, { created_at: 'asc' }],
  });
  return lista.map(toTipo);
}

/** `{ nome, turma_id, disciplina_id, bimestre, peso?, categoria?, ordem?, descricao? }`. Sem `ordem`, vai para o fim. */
export async function createTipo(auth: SessionUser, body: unknown): Promise<TipoRow> {
  const dados = lerTipo(body, false);
  await assertTurmaEDisciplina(auth, dados.turma_id, dados.disciplina_id);
  const ordem =
    dados.ordem ??
    (await prisma.tipos_avaliacao.count({
      where: { user_id: auth.user.id, turma_id: dados.turma_id, disciplina_id: dados.disciplina_id, bimestre: dados.bimestre },
    })) + 1;
  const tipo = await prisma.tipos_avaliacao.create({ data: { ...dados, nome: dados.nome!, ordem, user_id: auth.user.id } });
  return toTipo(tipo);
}

/** Altera só o enviado. Mudar o bimestre leva junto o bimestre das notas da avaliação. */
export async function updateTipo(auth: SessionUser, id: string, body: unknown): Promise<TipoRow> {
  const dados = lerTipo(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  // As notas já lançadas são de alunos daquela turma: trocar turma ou matéria as deixaria soltas.
  if (dados.turma_id !== undefined || dados.disciplina_id !== undefined) {
    throw invalido('A turma e a matéria de uma avaliação não mudam. Crie uma nova avaliação.');
  }
  await buscarTipoEditavel(auth, id);
  const [tipo] = await prisma.$transaction([
    prisma.tipos_avaliacao.update({ where: { id }, data: dados }),
    ...(dados.bimestre ? [prisma.notas.updateMany({ where: { tipo_avaliacao_id: id }, data: { bimestre: dados.bimestre } })] : []),
  ]);
  return toTipo(tipo as tipos_avaliacao);
}

/** Apaga junto as notas da avaliação (a tela já avisa: "As notas serão excluídas"). */
export async function deleteTipo(auth: SessionUser, id: string): Promise<void> {
  await buscarTipoEditavel(auth, id);
  await prisma.tipos_avaliacao.delete({ where: { id } });
}

/** `{ ids: [...] }`: nova ordem das colunas (1, 2, 3…), numa operação só. */
export async function reordenarTipos(auth: SessionUser, body: unknown): Promise<TipoRow[]> {
  const ids = (body as { ids?: unknown } | undefined)?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || !isUuid(i)) || new Set(ids).size !== ids.length) {
    throw invalido('Envie "ids" com as avaliações na nova ordem, sem repetir.');
  }
  if (ids.length > 200) throw invalido('No máximo 200 avaliações.');
  const tipos = await prisma.tipos_avaliacao.findMany({ where: { id: { in: ids as string[] } } });
  if (tipos.length !== ids.length) throw tipoNaoEncontrado();
  for (const t of tipos) exigirEscrita(auth, t.user_id, tipoNaoEncontrado, 'Só o professor dono da avaliação pode alterá-la.');
  const atualizados = await prisma.$transaction(
    (ids as string[]).map((id, i) => prisma.tipos_avaliacao.update({ where: { id }, data: { ordem: i + 1 } })),
  );
  return atualizados.map(toTipo);
}

// ===== Notas: uma por aluno em cada avaliação =====

const comTipo = {
  tipo_avaliacao: { select: { nome: true, peso: true, bimestre: true, disciplina_id: true, turma_id: true, categoria: true } },
} satisfies Prisma.notasInclude;
type NotaComTipo = Prisma.notasGetPayload<{ include: typeof comTipo }>;

/** Uma nota com a avaliação junto (como `select('*, tipos_avaliacao(...)')`). */
export type NotaRow = Omit<notas, 'nota'> & {
  nota: number | null;
  tipos_avaliacao: (Omit<NonNullable<NotaComTipo['tipo_avaliacao']>, 'peso'> & { peso: number | null }) | null;
};
const toNota = ({ tipo_avaliacao: t, ...n }: NotaComTipo): NotaRow => ({
  ...n,
  nota: numero(n.nota),
  tipos_avaliacao: t ? { ...t, peso: numero(t.peso) } : null,
});

/** Padrão A. Filtros: alunos, avaliações (um ou vários), bimestre, turma e matéria (da avaliação). */
export async function listNotas(
  auth: SessionUser,
  f: { aluno_id?: string | string[]; tipo_avaliacao_id?: string | string[]; bimestre?: string; turma_id?: string; disciplina_id?: string },
): Promise<NotaRow[]> {
  const alunos = listaDeIds(f.aluno_id, 'aluno_id', 2000);
  const tipos = listaDeIds(f.tipo_avaliacao_id, 'tipo_avaliacao_id');
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  const lista = await prisma.notas.findMany({
    where: {
      ...filtroLeitura(auth),
      ...(alunos.length ? { aluno_id: { in: alunos } } : {}),
      ...(tipos.length ? { tipo_avaliacao_id: { in: tipos } } : {}),
      ...(bimestre ? { bimestre } : {}),
      ...(turma_id || disciplina_id
        ? { tipo_avaliacao: { ...(turma_id ? { turma_id } : {}), ...(disciplina_id ? { disciplina_id } : {}) } }
        : {}),
    },
    include: comTipo,
    orderBy: [{ tipo_avaliacao: { ordem: 'asc' } }, { created_at: 'asc' }],
  });
  return lista.map(toNota);
}

export const MAX_NOTAS = 2000;

interface LancamentoNota {
  aluno_id: string;
  tipo_avaliacao_id: string;
  nota: number | null;
  observacoes?: string | null;
}

function lerLancamentos(body: unknown): LancamentoNota[] {
  const lista = (body as { notas?: unknown } | undefined)?.notas;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie "notas" com pelo menos um lançamento.');
  if (lista.length > MAX_NOTAS) throw invalido(`No máximo ${MAX_NOTAS} notas por vez.`);
  const vistos = new Set<string>();
  return lista.map((item: unknown, i) => {
    const l = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const onde = `Lançamento ${i + 1}`;
    if (typeof l.aluno_id !== 'string' || !isUuid(l.aluno_id)) throw invalido(`${onde}: "aluno_id" inválido.`);
    if (typeof l.tipo_avaliacao_id !== 'string' || !isUuid(l.tipo_avaliacao_id)) throw invalido(`${onde}: "tipo_avaliacao_id" inválido.`);
    if (l.nota !== null && (typeof l.nota !== 'number' || !(l.nota >= 0 && l.nota <= 10))) {
      throw invalido(`${onde}: a nota deve ser de 0 a 10 (ou null para apagar).`);
    }
    if (l.observacoes !== undefined && l.observacoes !== null && typeof l.observacoes !== 'string') {
      throw invalido(`${onde}: "observacoes" deve ser um texto.`);
    }
    const chave = `${l.aluno_id}|${l.tipo_avaliacao_id}`;
    if (vistos.has(chave)) throw invalido(`${onde}: o mesmo aluno aparece duas vezes na mesma avaliação.`);
    vistos.add(chave);
    return { aluno_id: l.aluno_id, tipo_avaliacao_id: l.tipo_avaliacao_id, nota: l.nota as number | null, observacoes: l.observacoes as string | null | undefined };
  });
}

/**
 * `{ notas: [{ aluno_id, tipo_avaliacao_id, nota, observacoes? }] }`: lança ou corrige várias
 * notas de uma vez (uma célula da planilha é uma lista de um item). `nota: null` apaga. O
 * bimestre e o dono vêm da avaliação; o aluno precisa ser da turma dela (ou membro da eletiva).
 * Ou entra tudo, ou nada.
 */
export async function lancarNotas(auth: SessionUser, body: unknown): Promise<{ salvas: NotaRow[]; apagadas: number }> {
  const lancamentos = lerLancamentos(body);
  const tipoIds = [...new Set(lancamentos.map((l) => l.tipo_avaliacao_id))];
  const tipos = new Map((await prisma.tipos_avaliacao.findMany({ where: { id: { in: tipoIds } } })).map((t) => [t.id, t]));
  for (const id of tipoIds) {
    const tipo = tipos.get(id);
    if (!tipo || !podeLer(auth, tipo.user_id)) throw tipoNaoEncontrado();
    if (!podeEscrever(auth, tipo.user_id)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só o professor dono da avaliação lança as notas.');
  }

  // O aluno precisa pertencer à turma da avaliação: direto ou como membro (eletiva).
  const alunoIds = [...new Set(lancamentos.map((l) => l.aluno_id))];
  const alunos = new Map((await prisma.alunos.findMany({ where: { id: { in: alunoIds } }, select: { id: true, turma_id: true } })).map((a) => [a.id, a.turma_id]));
  const membros = new Set(
    (await prisma.turma_membros.findMany({ where: { aluno_id: { in: alunoIds } }, select: { aluno_id: true, turma_id: true } })).map(
      (m) => `${m.aluno_id}|${m.turma_id}`,
    ),
  );
  lancamentos.forEach((l, i) => {
    const turma = tipos.get(l.tipo_avaliacao_id)!.turma_id;
    if (!alunos.has(l.aluno_id)) throw new HttpError(400, 'ALUNO_INVALIDO', `Lançamento ${i + 1}: o aluno não existe.`);
    if (turma && alunos.get(l.aluno_id) !== turma && !membros.has(`${l.aluno_id}|${turma}`)) {
      throw new HttpError(400, 'ALUNO_FORA_DA_TURMA', `Lançamento ${i + 1}: o aluno não é da turma desta avaliação.`);
    }
  });

  const salvar = lancamentos.filter((l) => l.nota !== null);
  const apagar = lancamentos.filter((l) => l.nota === null);
  const resultado = await prisma.$transaction([
    ...salvar.map((l) => {
      const tipo = tipos.get(l.tipo_avaliacao_id)!;
      const dados = {
        nota: new Prisma.Decimal(l.nota!.toFixed(2)),
        bimestre: tipo.bimestre,
        user_id: tipo.user_id,
        ...(l.observacoes !== undefined ? { observacoes: l.observacoes } : {}),
      };
      return prisma.notas.upsert({
        where: { aluno_id_tipo_avaliacao_id: { aluno_id: l.aluno_id, tipo_avaliacao_id: l.tipo_avaliacao_id } },
        create: { aluno_id: l.aluno_id, tipo_avaliacao_id: l.tipo_avaliacao_id, ...dados },
        update: dados,
        include: comTipo,
      });
    }),
    ...(apagar.length
      ? [prisma.notas.deleteMany({ where: { OR: apagar.map((l) => ({ aluno_id: l.aluno_id, tipo_avaliacao_id: l.tipo_avaliacao_id })) } })]
      : []),
  ]);
  const apagadas = apagar.length ? (resultado.at(-1) as Prisma.BatchPayload).count : 0;
  return { salvas: (resultado.slice(0, salvar.length) as NotaComTipo[]).map(toNota), apagadas };
}
