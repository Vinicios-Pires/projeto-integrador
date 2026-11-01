import type { alunos, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalBoolean, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { filtroLeitura } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';

/**
 * Um aluno como as telas esperam: as colunas da tabela + `turmas: { nome, serie }`
 * (mesmo formato do `select('*, turmas(nome, serie)')` do Supabase).
 */
export type AlunoRow = Omit<alunos, 'data_nascimento'> & {
  data_nascimento: string | null;
  turmas: { nome: string; serie: string } | null;
};

const comTurma = { turma: { select: { nome: true, serie: true } } } satisfies Prisma.alunosInclude;
type AlunoComTurma = Prisma.alunosGetPayload<{ include: typeof comTurma }>;

function toRow({ turma, data_nascimento, ...a }: AlunoComTurma): AlunoRow {
  // Data pura (AAAA-MM-DD), como o Postgres/Supabase devolve.
  return { ...a, data_nascimento: data_nascimento?.toISOString().slice(0, 10) ?? null, turmas: turma };
}

export const alunoNaoEncontrado = () => new HttpError(404, 'ALUNO_NAO_ENCONTRADO', 'Aluno não encontrado.');
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
const turmaInvalida = () => new HttpError(400, 'TURMA_INVALIDA', 'A turma informada não existe.');

const ORDENS = {
  turma: [{ turma: { nome: 'asc' } }, { numero_chamada: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
  numero_chamada: [{ numero_chamada: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
  nome: [{ nome: 'asc' }],
} satisfies Record<string, Prisma.alunosOrderByWithRelationInput[]>;

/** Filtros das telas: `turma_id` (um ou vários, separados por vírgula), `ativo` e `ordem`. */
export interface FiltrosAlunos {
  turma_id?: string | string[];
  ativo?: string;
  ordem?: string;
}

/** Cadastro compartilhado da escola (padrão C): todo usuário logado vê todos os alunos. */
export async function listAlunos(filtros: FiltrosAlunos): Promise<AlunoRow[]> {
  const turmaIds = [filtros.turma_id ?? []].flat().flatMap((v) => v.split(',')).filter(Boolean);
  if (turmaIds.some((id) => !isUuid(id))) throw invalido('"turma_id" inválido.');
  if (filtros.ativo !== undefined && !['true', 'false'].includes(filtros.ativo)) {
    throw invalido('"ativo" inválido. Use: true, false.');
  }
  const ordem = filtros.ordem ?? 'turma';
  if (!(ordem in ORDENS)) throw invalido(`"ordem" inválida. Use: ${Object.keys(ORDENS).join(', ')}.`);

  const lista = await prisma.alunos.findMany({
    where: {
      ...(turmaIds.length ? { turma_id: { in: turmaIds } } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo === 'true' } : {}),
    },
    include: comTurma,
    orderBy: ORDENS[ordem as keyof typeof ORDENS],
  });
  return lista.map(toRow);
}

export async function getAluno(id: string): Promise<AlunoRow> {
  const aluno = await prisma.alunos.findUnique({ where: { id }, include: comTurma });
  if (!aluno) throw alunoNaoEncontrado();
  return toRow(aluno);
}

/** Lê só os campos editáveis do corpo; o resto é ignorado. */
function lerDados(body: unknown, parcial: boolean) {
  const turma_id = optionalString(body, 'turma_id');
  if (turma_id === null || (turma_id === undefined && !parcial)) throw invalido('O campo "turma_id" é obrigatório.');
  if (turma_id !== undefined && !isUuid(turma_id)) throw turmaInvalida();
  return {
    turma_id,
    nome: requiredText(body, 'nome', parcial),
    numero_chamada: optionalInt(body, 'numero_chamada', 0, 9999),
    serie: optionalString(body, 'serie'),
    data_nascimento: optionalDate(body, 'data_nascimento'),
    email: optionalString(body, 'email'),
    telefone: optionalString(body, 'telefone'),
    responsavel: optionalString(body, 'responsavel'),
    observacoes: optionalString(body, 'observacoes'),
    ativo: optionalBoolean(body, 'ativo'),
  };
}

async function turmaDestino(id: string) {
  const turma = await prisma.turmas.findUnique({ where: { id }, select: { serie: true } });
  if (!turma) throw turmaInvalida();
  return turma;
}

/** Mesma trava da tela: não pode haver dois alunos com o mesmo nome na mesma turma. */
async function assertSemDuplicado(nome: string, turma_id: string, ignorarId?: string) {
  const existe = await prisma.alunos.findFirst({
    where: { turma_id, nome: { equals: nome, mode: 'insensitive' }, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
    select: { id: true },
  });
  if (existe) throw new HttpError(409, 'ALUNO_DUPLICADO', 'Já existe um aluno com esse nome nesta turma.');
}

/** Sem série informada, o aluno herda a série da turma (como a tela faz). */
export async function createAluno(body: unknown): Promise<AlunoRow> {
  const dados = lerDados(body, false);
  const turma = await turmaDestino(dados.turma_id!);
  await assertSemDuplicado(dados.nome!, dados.turma_id!);
  const aluno = await prisma.alunos.create({
    data: { ...dados, nome: dados.nome!, serie: dados.serie ?? turma.serie },
    include: comTurma,
  });
  return toRow(aluno);
}

/** Altera só os campos enviados. Dá para trocar o aluno de turma. */
export async function updateAluno(id: string, body: unknown): Promise<AlunoRow> {
  const dados = lerDados(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  const atual = await prisma.alunos.findUnique({ where: { id }, select: { nome: true, turma_id: true } });
  if (!atual) throw alunoNaoEncontrado();

  if (dados.turma_id) await turmaDestino(dados.turma_id);
  const turma_id = dados.turma_id ?? atual.turma_id;
  if (turma_id && (dados.nome !== undefined || dados.turma_id !== undefined)) {
    await assertSemDuplicado(dados.nome ?? atual.nome, turma_id, id);
  }
  return toRow(await prisma.alunos.update({ where: { id }, data: dados, include: comTurma }));
}

/** Só a gestão exclui (ver a rota). Notas e registros do aluno saem junto; para preservar, inative. */
export async function deleteAluno(id: string): Promise<void> {
  const { count } = await prisma.alunos.deleteMany({ where: { id } });
  if (count === 0) throw alunoNaoEncontrado();
}

// ===== Importação da planilha (tela Alunos) =====

export const MAX_LINHAS_IMPORTACAO = 2000;

/** "7A", "7º A", "7°a", "7 A" → "7°A" (mesmo formato aceito pela tela). */
export function normalizarTurma(raw: string): string | null {
  const limpo = raw.trim().toUpperCase().replace(/[ºO]/g, '°').replace(/\s+/g, '');
  const match = limpo.match(/^(\d{1,2})°?([A-Z])$/);
  return match ? `${match[1]}°${match[2]}` : null;
}

/** Chave para comparar nomes de turma ("7º A" e "7°A" são a mesma turma). */
const chaveTurma = (nome: string) => normalizarTurma(nome) ?? nome.toUpperCase().replace(/\s+/g, '');

/** Série de uma turma criada pela importação, no formato da tela Turmas. */
export function inferirSerie(turma: string): string {
  const num = parseInt(turma, 10);
  if (num >= 6 && num <= 9) return `${num}º Ano`;
  if (num >= 1 && num <= 3) return `${num}º Ano EM`;
  return turma;
}

export interface ResultadoImportacao {
  importados: number;
  turmas_criadas: string[];
  /** `linha` = posição na lista enviada (começando em 1). */
  erros: { linha: number; motivo: string }[];
}

/**
 * `{ linhas: [{ numero_chamada?, nome, turma }] }`, uma por linha da planilha.
 * Linhas com problema são puladas e voltam em `erros`; as outras entram. Turmas que o
 * usuário ainda não tem são criadas no nome dele. Ou entra tudo (turmas e alunos), ou nada.
 */
export async function importAlunos(auth: SessionUser, body: unknown): Promise<ResultadoImportacao> {
  const linhas = (body as { linhas?: unknown } | undefined)?.linhas;
  if (!Array.isArray(linhas) || linhas.length === 0) throw invalido('Envie a lista "linhas" com pelo menos um aluno.');
  if (linhas.length > MAX_LINHAS_IMPORTACAO) {
    throw invalido(`A importação aceita até ${MAX_LINHAS_IMPORTACAO} linhas por vez.`);
  }

  // Turmas que o usuário enxerga (as dele; a gestão, todas). Com nomes repetidos, vale a mais antiga.
  const visiveis = await prisma.turmas.findMany({
    where: filtroLeitura(auth),
    select: { id: true, nome: true, serie: true },
    orderBy: { created_at: 'asc' },
  });
  const turmas = new Map<string, { id?: string; nome: string; serie: string }>();
  for (const t of visiveis) if (!turmas.has(chaveTurma(t.nome))) turmas.set(chaveTurma(t.nome), t);

  const chavePorId = new Map([...turmas].map(([chave, t]) => [t.id!, chave]));
  const existentes = await prisma.alunos.findMany({
    where: { turma_id: { in: [...chavePorId.keys()] } },
    select: { nome: true, turma_id: true },
  });
  const jaExiste = new Set(existentes.map((a) => `${chavePorId.get(a.turma_id!)}|${a.nome.trim().toLowerCase()}`));

  const resultado: ResultadoImportacao = { importados: 0, turmas_criadas: [], erros: [] };
  const novos: { nome: string; numero_chamada: number | null; turma: string }[] = [];

  linhas.forEach((linha: unknown, i) => {
    const erro = (motivo: string) => resultado.erros.push({ linha: i + 1, motivo });
    const l = (typeof linha === 'object' && linha !== null ? linha : {}) as Record<string, unknown>;
    const nome = typeof l.nome === 'string' ? l.nome.trim() : '';
    const turmaRaw = typeof l.turma === 'string' ? l.turma : '';
    const numero = l.numero_chamada ?? null;

    if (!nome) return erro('nome vazio');
    const turma = normalizarTurma(turmaRaw);
    if (!turma) return erro(`formato de turma inválido "${turmaRaw}" (use ex.: 7°A)`);
    if (numero !== null && (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 0 || numero > 9999)) {
      return erro('número da chamada inválido');
    }
    const duplicado = `${turma}|${nome.toLowerCase()}`;
    if (jaExiste.has(duplicado)) return erro(`aluno "${nome}" já existe em ${turma}`);

    if (!turmas.has(turma)) {
      turmas.set(turma, { nome: turma, serie: inferirSerie(turma) });
      resultado.turmas_criadas.push(turma);
    }
    jaExiste.add(duplicado);
    novos.push({ nome, numero_chamada: numero as number | null, turma });
  });

  if (novos.length === 0) return resultado;

  await prisma.$transaction(
    async (tx) => {
      const criadas = await tx.turmas.createManyAndReturn({
        data: resultado.turmas_criadas.map((nome) => ({ nome, serie: turmas.get(nome)!.serie, turno: 'Manhã', user_id: auth.user.id })),
        select: { id: true, nome: true },
      });
      for (const t of criadas) turmas.get(t.nome)!.id = t.id;

      await tx.alunos.createMany({
        data: novos.map((a) => {
          const turma = turmas.get(a.turma)!;
          return { nome: a.nome, numero_chamada: a.numero_chamada, turma_id: turma.id!, serie: turma.serie, ativo: true };
        }),
      });
    },
    { timeout: 30_000 },
  );
  resultado.importados = novos.length;
  return resultado;
}
