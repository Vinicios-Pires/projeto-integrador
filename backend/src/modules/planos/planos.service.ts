import type { ajustes_plano, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, bimestreDaQuery, listaDeIds } from '../avaliacoes/avaliacoes.service';
import { planejamentoNaoEncontrado } from '../planejamentos/planejamentos.service';
import { armazenamento } from '../files/files.service';
import { isGestao } from '../../middlewares/roles';

// ===== Planos de aula: cada aula da planilha do planejamento (ou solta) =====

export const planoNaoEncontrado = () => new HttpError(404, 'PLANO_NAO_ENCONTRADO', 'Plano de aula não encontrado.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
const planilhaValidada = () =>
  new HttpError(409, 'PLANEJAMENTO_VALIDADO', 'O planejamento desta aula já foi validado. A gestão precisa reabri-lo para mudar as aulas.');

export const MAX_LOTE = 200;
export const BUCKET_ANEXOS = 'plano-anexos';
/** Aprovação de cada aula pela gestão: `ajustado` é a aula devolvida com pedido de ajuste. */
export const STATUS_APROVACAO = ['pendente', 'aprovado', 'ajustado'];
const VOLTA_A_PENDENTE = { status: 'pendente', aprovado_por: null, data_aprovacao: null };
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const dia = (d: Date) => d.toISOString().slice(0, 10);

const comTurmaEDisciplina = {
  turma: { select: { nome: true, serie: true } },
  disciplina: { select: { nome: true } },
} satisfies Prisma.planos_aulaInclude;
type PlanoComDados = Prisma.planos_aulaGetPayload<{ include: typeof comTurmaEDisciplina }>;

/** Um plano com a turma e a matéria junto (como `select('*, turmas(nome), disciplinas(nome)')`). */
export type PlanoRow = Omit<PlanoComDados, 'turma' | 'disciplina' | 'data_aula'> & {
  data_aula: string;
  turmas: PlanoComDados['turma'];
  disciplinas: PlanoComDados['disciplina'];
};
const toPlano = ({ turma, disciplina, data_aula, ...p }: PlanoComDados): PlanoRow => ({
  ...p,
  data_aula: dia(data_aula),
  turmas: turma,
  disciplinas: disciplina,
});

/** Os textos da aula, que a tela edita célula por célula. */
const TEXTOS = [
  'aprendizagem_essencial',
  'conteudo',
  'objetivos',
  'recursos',
  'desenvolvimento',
  'material_digital',
  'avaliacao_aprendizagem',
  'professor',
  'habilidades',
  'objetivo_geral',
] as const;

/** O que se edita numa aula. O dia da semana vem da data. A situação de aprovação não muda aqui. */
function lerConteudo(body: unknown) {
  const data_aula = optionalDate(body, 'data_aula');
  if (data_aula === null) throw invalido('O campo "data_aula" não pode ficar vazio.');
  const textos = Object.fromEntries(TEXTOS.map((campo) => [campo, optionalString(body, campo)])) as Record<(typeof TEXTOS)[number], string | null | undefined>;
  return {
    ...textos,
    data_aula,
    ...(data_aula ? { dia_semana: DIAS[data_aula.getUTCDay()] } : {}),
    numero_aulas: optionalInt(body, 'numero_aulas', 0, 20),
    aulas_previstas: optionalInt(body, 'aulas_previstas', 0, 1000),
  };
}

/** Turma, matéria e bimestre: só para aulas fora de um planejamento (dentro, vêm dele). */
function lerVinculo(body: unknown) {
  return {
    turma_id: optionalString(body, 'turma_id'),
    disciplina_id: optionalString(body, 'disciplina_id'),
    bimestre: optionalInt(body, 'bimestre', 1, 4) ?? undefined,
  };
}

/** A planilha validada fica travada: nenhuma aula entra, muda ou sai. */
async function assertPlanilhaAberta(planejamento_id: string | null) {
  if (!planejamento_id) return;
  const p = await prisma.planejamentos_bimestrais.findUnique({ where: { id: planejamento_id }, select: { status: true } });
  if (p?.status === 'validado') throw planilhaValidada();
}

async function buscarPlano(auth: SessionUser, id: string) {
  const plano = await prisma.planos_aula.findUnique({ where: { id } });
  if (!plano || !podeLer(auth, plano.user_id)) throw planoNaoEncontrado();
  return plano;
}

export async function buscarPlanoEditavel(auth: SessionUser, id: string) {
  const plano = await prisma.planos_aula.findUnique({ where: { id } });
  if (!plano) throw planoNaoEncontrado();
  exigirEscrita(auth, plano.user_id, planoNaoEncontrado, 'Só o professor dono pode alterar o plano de aula.');
  await assertPlanilhaAberta(plano.planejamento_id);
  return plano;
}

function dataDaQuery(valor: string | undefined, campo: string): Date | undefined {
  if (valor === undefined) return undefined;
  const d = optionalDate({ [campo]: valor }, campo);
  return d ?? undefined;
}

/**
 * Padrão A. Filtros: planejamento, turma, matéria, bimestre, professor, situação, um dia (`data`)
 * ou um período (`de`, `ate`), e `limite`. Em ordem de data.
 */
export async function listPlanos(
  auth: SessionUser,
  f: {
    planejamento_id?: string; turma_id?: string; disciplina_id?: string; bimestre?: string; user_id?: string;
    status?: string; data?: string; de?: string; ate?: string; limite?: string;
  },
): Promise<PlanoRow[]> {
  const [planejamento_id] = listaDeIds(f.planejamento_id, 'planejamento_id', 1);
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  const data = dataDaQuery(f.data, 'data');
  const de = dataDaQuery(f.de, 'de');
  const ate = dataDaQuery(f.ate, 'ate');
  let limite: number | undefined;
  if (f.limite !== undefined) {
    limite = Number(f.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw invalido('"limite" deve ser de 1 a 1000.');
  }
  const lista = await prisma.planos_aula.findMany({
    where: {
      AND: [filtroLeitura(auth), user_id ? { user_id } : {}],
      ...(planejamento_id ? { planejamento_id } : {}),
      ...(turma_id ? { turma_id } : {}),
      ...(disciplina_id ? { disciplina_id } : {}),
      ...(bimestre ? { bimestre } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(data ? { data_aula: data } : de || ate ? { data_aula: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}),
    },
    include: comTurmaEDisciplina,
    orderBy: [{ data_aula: 'asc' }, { created_at: 'asc' }],
    ...(limite ? { take: limite } : {}),
  });
  return lista.map(toPlano);
}

export async function getPlano(auth: SessionUser, id: string): Promise<PlanoRow> {
  await buscarPlano(auth, id);
  return toPlano(await prisma.planos_aula.findUniqueOrThrow({ where: { id }, include: comTurmaEDisciplina }));
}

/** O planejamento em que as aulas vão entrar: do próprio professor (ou admin) e ainda aberto. */
async function planejamentoEditavel(auth: SessionUser, planejamento_id: string) {
  const p = isUuid(planejamento_id) ? await prisma.planejamentos_bimestrais.findUnique({ where: { id: planejamento_id } }) : null;
  if (!p) throw planejamentoNaoEncontrado();
  exigirEscrita(auth, p.user_id, planejamentoNaoEncontrado, 'Só o professor dono pode mudar as aulas do planejamento.');
  if (p.status === 'validado') throw planilhaValidada();
  return p;
}

/**
 * `{ data_aula, planejamento_id?, turma_id?, disciplina_id?, bimestre?, ...textos }`. Dentro de um
 * planejamento, turma, matéria, bimestre e dono vêm dele; fora, o dono é quem cria.
 */
export async function createPlano(auth: SessionUser, body: unknown): Promise<PlanoRow> {
  const conteudo = lerConteudo(body);
  if (!conteudo.data_aula) throw invalido('O campo "data_aula" é obrigatório.');
  const planejamento_id = optionalString(body, 'planejamento_id');
  let vinculo: { user_id: string; turma_id: string | null; disciplina_id: string | null; bimestre: number; planejamento_id: string | null };
  if (planejamento_id) {
    const p = await planejamentoEditavel(auth, planejamento_id);
    vinculo = { user_id: p.user_id, turma_id: p.turma_id, disciplina_id: p.disciplina_id, bimestre: p.bimestre, planejamento_id: p.id };
  } else {
    const v = lerVinculo(body);
    await assertTurmaEDisciplina(auth, v.turma_id ?? undefined, v.disciplina_id ?? undefined);
    vinculo = { user_id: auth.user.id, turma_id: v.turma_id ?? null, disciplina_id: v.disciplina_id ?? null, bimestre: v.bimestre ?? 1, planejamento_id: null };
  }
  const plano = await prisma.planos_aula.create({
    data: { ...conteudo, data_aula: conteudo.data_aula, numero_aulas: conteudo.numero_aulas ?? 1, ...vinculo, tipo: 'normal', status: 'pendente' },
    include: comTurmaEDisciplina,
  });
  return toPlano(plano);
}

/** `{ datas: ['AAAA-MM-DD', ...], numero_aulas? }`: "datas em sequência" (uma aula por data). */
export async function adicionarAulas(auth: SessionUser, planejamento_id: string, body: unknown): Promise<PlanoRow[]> {
  const p = await planejamentoEditavel(auth, planejamento_id);
  const datas = (body as { datas?: unknown } | undefined)?.datas;
  if (!Array.isArray(datas) || datas.length === 0) throw invalido('Envie "datas" com pelo menos uma data.');
  if (datas.length > MAX_LOTE) throw invalido(`No máximo ${MAX_LOTE} aulas por vez.`);
  const convertidas = datas.map((valor, i) => {
    const d = optionalDate({ data: valor }, 'data');
    if (!d) throw invalido(`Data ${i + 1}: use o formato AAAA-MM-DD.`);
    return d;
  });
  const numero_aulas = optionalInt(body, 'numero_aulas', 0, 20) ?? 1;
  const criadas = await prisma.planos_aula.createManyAndReturn({
    data: convertidas.map((data_aula) => ({
      data_aula,
      dia_semana: DIAS[data_aula.getUTCDay()],
      numero_aulas,
      user_id: p.user_id,
      turma_id: p.turma_id,
      disciplina_id: p.disciplina_id,
      bimestre: p.bimestre,
      planejamento_id: p.id,
      tipo: 'normal',
      status: 'pendente',
    })),
    include: comTurmaEDisciplina,
  });
  return criadas.map(toPlano).sort((a, b) => a.data_aula.localeCompare(b.data_aula));
}

/**
 * Altera só o enviado. Turma, matéria e bimestre só mudam em aula fora de planejamento.
 * Planilha validada não muda. Aula já aprovada (ou devolvida) que é editada volta a pendente.
 */
export async function updatePlano(auth: SessionUser, id: string, body: unknown): Promise<PlanoRow> {
  const conteudo = lerConteudo(body);
  const vinculo = lerVinculo(body);
  const dados = { ...conteudo, ...vinculo };
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const plano = await buscarPlanoEditavel(auth, id);
  const mudaVinculo = Object.values(vinculo).some((v) => v !== undefined);
  if (mudaVinculo && plano.planejamento_id) {
    throw invalido('Turma, matéria e bimestre de uma aula do planejamento vêm do planejamento.');
  }
  if (mudaVinculo) await assertTurmaEDisciplina(auth, vinculo.turma_id ?? undefined, vinculo.disciplina_id ?? undefined);
  const volta = plano.status === 'pendente' ? {} : VOLTA_A_PENDENTE;
  return toPlano(await prisma.planos_aula.update({ where: { id }, data: { ...dados, ...volta }, include: comTurmaEDisciplina }));
}

/** `{ ids: [...], dados: { campo: valor, ... } }`: "copiar para baixo" (o mesmo valor em várias aulas). */
export async function updatePlanosEmLote(auth: SessionUser, body: unknown): Promise<{ alteradas: number }> {
  const { ids, dados: bruto } = (body ?? {}) as { ids?: unknown; dados?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || !isUuid(i)) || new Set(ids).size !== ids.length) {
    throw invalido('Envie "ids" com as aulas, sem repetir.');
  }
  if (ids.length > MAX_LOTE) throw invalido(`No máximo ${MAX_LOTE} aulas por vez.`);
  if (typeof bruto !== 'object' || bruto === null) throw invalido('Envie "dados" com os campos a copiar.');
  const dados = lerConteudo(bruto);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para copiar.');
  const planos = await prisma.planos_aula.findMany({ where: { id: { in: ids as string[] } }, select: { user_id: true, planejamento_id: true } });
  if (planos.length !== ids.length) throw planoNaoEncontrado();
  for (const p of planos) exigirEscrita(auth, p.user_id, planoNaoEncontrado, 'Só o professor dono pode alterar o plano de aula.');
  for (const planejamento of new Set(planos.map((p) => p.planejamento_id))) await assertPlanilhaAberta(planejamento);
  const [{ count }] = await prisma.$transaction([
    prisma.planos_aula.updateMany({ where: { id: { in: ids as string[] } }, data: dados }),
    prisma.planos_aula.updateMany({ where: { id: { in: ids as string[] }, status: { not: 'pendente' } }, data: VOLTA_A_PENDENTE }),
  ]);
  return { alteradas: count };
}

/** Os anexos (com os arquivos) e os ajustes saem junto. As cópias dele continuam, só sem a ligação. */
export async function deletePlano(auth: SessionUser, id: string): Promise<void> {
  await buscarPlanoEditavel(auth, id);
  const anexos = await prisma.plano_anexos.findMany({ where: { plano_id: id }, select: { storage_path: true } });
  await prisma.$transaction([
    prisma.planos_aula.updateMany({ where: { duplicado_de: id }, data: { duplicado_de: null } }),
    prisma.planos_aula.delete({ where: { id } }),
  ]);
  if (anexos.length) await armazenamento.excluir(BUCKET_ANEXOS, anexos.map((a) => a.storage_path));
}

/**
 * `{ data_aula? }`: copia a aula para outra data (padrão: uma semana depois), no mesmo planejamento,
 * como pendente. A cópia guarda de onde veio. Os anexos e ajustes não vão junto.
 */
export async function duplicarPlano(auth: SessionUser, id: string, body: unknown): Promise<PlanoRow> {
  const original = await buscarPlanoEditavel(auth, id);
  const data = optionalDate(body ?? {}, 'data_aula') ?? new Date(original.data_aula.getTime() + 7 * 86_400_000);
  const { id: _id, created_at, updated_at, aprovado_por, data_aprovacao, comentario_aprovacao, ...copia } = original;
  const plano = await prisma.planos_aula.create({
    data: { ...copia, data_aula: data, dia_semana: DIAS[data.getUTCDay()], duplicado_de: id, tipo: 'normal', status: 'pendente' },
    include: comTurmaEDisciplina,
  });
  return toPlano(plano);
}

// ===== Ajustes (PDCA): o histórico do que foi ajustado em cada aula =====

export async function listAjustes(auth: SessionUser, id: string): Promise<ajustes_plano[]> {
  await buscarPlano(auth, id);
  return prisma.ajustes_plano.findMany({ where: { plano_id: id }, orderBy: { created_at: 'desc' } });
}

/** `{ descricao }`. Só o dono (ou o admin), como na tela, e com a planilha aberta. */
export async function registrarAjuste(auth: SessionUser, id: string, body: unknown): Promise<ajustes_plano> {
  const descricao = requiredText(body, 'descricao');
  const plano = await prisma.planos_aula.findUnique({ where: { id }, select: { user_id: true, planejamento_id: true } });
  if (!plano) throw planoNaoEncontrado();
  exigirEscrita(auth, plano.user_id, planoNaoEncontrado, 'Só o professor dono registra ajustes no plano de aula.');
  await assertPlanilhaAberta(plano.planejamento_id);
  return prisma.ajustes_plano.create({ data: { plano_id: id, descricao: descricao! } });
}

// ===== Aprovação de cada aula pela gestão (padrão E) =====

/**
 * `{ ids: [...], status, comentario? }`: a gestão aprova, devolve para ajuste (`ajustado`) ou volta
 * a pendente uma ou várias aulas de uma vez. Grava quem fez e quando. Não depende da planilha estar
 * aberta: aprovar não muda o conteúdo da aula.
 */
export async function aprovarPlanos(auth: SessionUser, body: unknown): Promise<PlanoRow[]> {
  if (!isGestao(auth.role)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só a gestão aprova os planos de aula.');
  const { ids } = (body ?? {}) as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || !isUuid(i)) || new Set(ids).size !== ids.length) {
    throw invalido('Envie "ids" com as aulas, sem repetir.');
  }
  if (ids.length > MAX_LOTE) throw invalido(`No máximo ${MAX_LOTE} aulas por vez.`);
  const status = optionalString(body, 'status');
  if (!status || !STATUS_APROVACAO.includes(status)) throw invalido(`"status" deve ser ${STATUS_APROVACAO.join(', ')}.`);
  const comentario = optionalString(body, 'comentario');
  if ((await prisma.planos_aula.count({ where: { id: { in: ids as string[] } } })) !== ids.length) throw planoNaoEncontrado();

  const data =
    status === 'pendente'
      ? { ...VOLTA_A_PENDENTE, ...(comentario !== undefined ? { comentario_aprovacao: comentario } : {}) }
      : { status, aprovado_por: auth.user.id, data_aprovacao: new Date(), comentario_aprovacao: comentario ?? null };
  await prisma.planos_aula.updateMany({ where: { id: { in: ids as string[] } }, data });
  const lista = await prisma.planos_aula.findMany({ where: { id: { in: ids as string[] } }, include: comTurmaEDisciplina, orderBy: { data_aula: 'asc' } });
  return lista.map(toPlano);
}
