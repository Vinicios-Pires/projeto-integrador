import type { pdi_evidencia_documentos, pdi_evidencia_fotos, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalChoice, optionalDate, optionalInt, optionalString, requiredText } from '../../lib/body';
import { exigirEscrita, filtroLeitura, podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { assertTurmaEDisciplina, bimestreDaQuery, listaDeIds } from '../avaliacoes/avaliacoes.service';
import { armazenamento, enviarArquivo } from '../files/files.service';

// ===== PDI: as evidências do plano de desenvolvimento do professor, com fotos e documentos =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const evidenciaNaoEncontrada = () => new HttpError(404, 'EVIDENCIA_NAO_ENCONTRADA', 'Evidência não encontrada.');
export const BUCKET_FOTOS = 'pdi-fotos';
export const BUCKET_DOCUMENTOS = 'pdi-documentos';

/** Os tipos de atividade da tela. */
export const TIPOS_ATIVIDADE = ['Aula prática', 'Jogo educativo', 'Projeto', 'Experimento', 'Tecnologia/Robótica', 'Atividade avaliativa', 'Outro'];

const comArquivos = {
  fotos: { orderBy: { created_at: 'asc' } },
  documentos: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.pdi_evidenciasInclude;
type EvidenciaComArquivos = Prisma.pdi_evidenciasGetPayload<{ include: typeof comArquivos }>;

type DocumentoRow = Omit<pdi_evidencia_documentos, 'tamanho_bytes'> & { tamanho_bytes: number | null };
const toDocumento = (d: pdi_evidencia_documentos): DocumentoRow => ({ ...d, tamanho_bytes: d.tamanho_bytes === null ? null : Number(d.tamanho_bytes) });

/** Com as fotos e os documentos junto (como `select('*, fotos:..., documentos:...')`). */
export type EvidenciaRow = Omit<EvidenciaComArquivos, 'data_realizacao' | 'documentos'> & { data_realizacao: string; documentos: DocumentoRow[] };
const toEvidencia = ({ data_realizacao, documentos, ...e }: EvidenciaComArquivos): EvidenciaRow => ({
  ...e,
  data_realizacao: data_realizacao.toISOString().slice(0, 10),
  documentos: documentos.map(toDocumento),
});

function lerEvidencia(body: unknown, parcial: boolean) {
  const data_realizacao = optionalDate(body, 'data_realizacao');
  if (data_realizacao === null) throw invalido('O campo "data_realizacao" não pode ficar vazio.');
  return {
    titulo: requiredText(body, 'titulo', parcial),
    data_realizacao,
    ano_letivo: optionalInt(body, 'ano_letivo', 2000, 2100) ?? undefined,
    bimestre: optionalInt(body, 'bimestre', 1, 4) ?? undefined,
    turma_id: optionalString(body, 'turma_id'),
    disciplina_id: optionalString(body, 'disciplina_id'),
    tipo_atividade: optionalChoice(body, 'tipo_atividade', TIPOS_ATIVIDADE),
    objetivo: optionalString(body, 'objetivo'),
    descricao: optionalString(body, 'descricao'),
    resultados: optionalString(body, 'resultados'),
  };
}

async function buscarEditavel(auth: SessionUser, id: string) {
  const e = await prisma.pdi_evidencias.findUnique({ where: { id } });
  if (!e) throw evidenciaNaoEncontrada();
  exigirEscrita(auth, e.user_id, evidenciaNaoEncontrada, 'Só o professor dono da evidência pode alterá-la.');
  return e;
}

/** Padrão A. Filtros: turma, matéria, bimestre, ano, tipo e professor. As mais recentes primeiro. */
export async function listEvidencias(
  auth: SessionUser,
  f: { turma_id?: string; disciplina_id?: string; bimestre?: string; ano_letivo?: string; tipo_atividade?: string; user_id?: string },
): Promise<EvidenciaRow[]> {
  const [turma_id] = listaDeIds(f.turma_id, 'turma_id', 1);
  const [disciplina_id] = listaDeIds(f.disciplina_id, 'disciplina_id', 1);
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  const bimestre = bimestreDaQuery(f.bimestre);
  let ano_letivo: number | undefined;
  if (f.ano_letivo !== undefined) {
    ano_letivo = Number(f.ano_letivo);
    if (!Number.isInteger(ano_letivo) || ano_letivo < 2000 || ano_letivo > 2100) throw invalido('"ano_letivo" inválido.');
  }
  const lista = await prisma.pdi_evidencias.findMany({
    where: {
      AND: [filtroLeitura(auth), user_id ? { user_id } : {}],
      ...(turma_id ? { turma_id } : {}),
      ...(disciplina_id ? { disciplina_id } : {}),
      ...(bimestre ? { bimestre } : {}),
      ...(ano_letivo ? { ano_letivo } : {}),
      ...(f.tipo_atividade ? { tipo_atividade: f.tipo_atividade } : {}),
    },
    include: comArquivos,
    orderBy: [{ data_realizacao: 'desc' }, { created_at: 'desc' }],
  });
  return lista.map(toEvidencia);
}

export async function getEvidencia(auth: SessionUser, id: string): Promise<EvidenciaRow> {
  const e = await prisma.pdi_evidencias.findUnique({ where: { id }, include: comArquivos });
  if (!e || !podeLer(auth, e.user_id)) throw evidenciaNaoEncontrada();
  return toEvidencia(e);
}

/** `{ titulo, data_realizacao?, ano_letivo?, bimestre?, turma_id?, disciplina_id?, tipo_atividade?, objetivo?, descricao?, resultados? }`. */
export async function createEvidencia(auth: SessionUser, body: unknown): Promise<EvidenciaRow> {
  const dados = lerEvidencia(body, false);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  return toEvidencia(await prisma.pdi_evidencias.create({ data: { ...dados, titulo: dados.titulo!, user_id: auth.user.id }, include: comArquivos }));
}

export async function updateEvidencia(auth: SessionUser, id: string, body: unknown): Promise<EvidenciaRow> {
  const dados = lerEvidencia(body, true);
  if (Object.values(dados).every((v) => v === undefined)) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarEditavel(auth, id);
  await assertTurmaEDisciplina(auth, dados.turma_id ?? undefined, dados.disciplina_id ?? undefined);
  return toEvidencia(await prisma.pdi_evidencias.update({ where: { id }, data: dados, include: comArquivos }));
}

/** As fotos e os documentos saem junto, do banco e do armazenamento. */
export async function deleteEvidencia(auth: SessionUser, id: string): Promise<void> {
  await buscarEditavel(auth, id);
  const [fotos, docs] = await Promise.all([
    prisma.pdi_evidencia_fotos.findMany({ where: { evidencia_id: id }, select: { storage_path: true } }),
    prisma.pdi_evidencia_documentos.findMany({ where: { evidencia_id: id }, select: { storage_path: true } }),
  ]);
  await prisma.pdi_evidencias.delete({ where: { id } });
  if (fotos.length) await armazenamento.excluir(BUCKET_FOTOS, fotos.map((f) => f.storage_path));
  if (docs.length) await armazenamento.excluir(BUCKET_DOCUMENTOS, docs.map((d) => d.storage_path));
}

type Envio = { nome: unknown; mime: string | undefined; conteudo: unknown };

/** Guarda o arquivo na pasta do dono da evidência e grava a linha; se o banco falhar, o arquivo sai. */
async function guardar<T>(auth: SessionUser, id: string, bucket: string, dados: Envio, gravar: (arquivo: Awaited<ReturnType<typeof enviarArquivo>>, dono: string) => Promise<T>) {
  const e = await buscarEditavel(auth, id);
  const arquivo = await enviarArquivo(auth, bucket, { pasta: e.id, ...dados }, e.user_id);
  try {
    return await gravar(arquivo, e.user_id);
  } catch (err) {
    await armazenamento.excluir(bucket, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

/** Corpo: a foto. `url` guarda o caminho, como a tela faz hoje (o link é assinado na hora de mostrar). */
export async function enviarFoto(auth: SessionUser, id: string, dados: Envio): Promise<pdi_evidencia_fotos> {
  return guardar(auth, id, BUCKET_FOTOS, dados, (a) =>
    prisma.pdi_evidencia_fotos.create({ data: { evidencia_id: id, storage_path: a.path, url: a.path, nome: a.nome } }),
  );
}

export async function enviarDocumento(auth: SessionUser, id: string, dados: Envio): Promise<DocumentoRow> {
  return guardar(auth, id, BUCKET_DOCUMENTOS, dados, async (a, dono) =>
    toDocumento(
      await prisma.pdi_evidencia_documentos.create({
        data: { evidencia_id: id, user_id: dono, storage_path: a.path, nome_arquivo: a.nome, mime_type: a.mime_type, tamanho_bytes: a.tamanho_bytes },
      }),
    ),
  );
}

const arquivoNaoEncontrado = () => new HttpError(404, 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo não encontrado.');

export async function deleteFoto(auth: SessionUser, id: string, fotoId: string): Promise<void> {
  await buscarEditavel(auth, id);
  const foto = isUuid(fotoId) ? await prisma.pdi_evidencia_fotos.findFirst({ where: { id: fotoId, evidencia_id: id } }) : null;
  if (!foto) throw arquivoNaoEncontrado();
  await prisma.pdi_evidencia_fotos.delete({ where: { id: foto.id } });
  await armazenamento.excluir(BUCKET_FOTOS, [foto.storage_path]);
}

export async function deleteDocumento(auth: SessionUser, id: string, docId: string): Promise<void> {
  await buscarEditavel(auth, id);
  const doc = isUuid(docId) ? await prisma.pdi_evidencia_documentos.findFirst({ where: { id: docId, evidencia_id: id } }) : null;
  if (!doc) throw arquivoNaoEncontrado();
  await prisma.pdi_evidencia_documentos.delete({ where: { id: doc.id } });
  await armazenamento.excluir(BUCKET_DOCUMENTOS, [doc.storage_path]);
}
