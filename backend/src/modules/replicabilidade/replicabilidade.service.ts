import type { Prisma, replicabilidade_fotos } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid, optionalString, requiredText } from '../../lib/body';
import { podeEscrever } from '../../lib/acesso';
import { isGestao } from '../../middlewares/roles';
import type { SessionUser } from '../auth/auth.service';
import { listaDeIds } from '../avaliacoes/avaliacoes.service';
import { armazenamento, enviarArquivo } from '../files/files.service';

// ===== Replicabilidade: o mural de boas práticas (padrão D: todo usuário logado vê tudo) =====

const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);
export const registroNaoEncontrado = () => new HttpError(404, 'REPLICABILIDADE_NAO_ENCONTRADA', 'Publicação não encontrada.');
export const BUCKET_FOTOS = 'replicabilidade-fotos';

const comDados = {
  fotos: { orderBy: [{ ordem: 'asc' }, { created_at: 'asc' }] },
  usuario: { select: { profile: { select: { nome: true } } } },
} satisfies Prisma.replicabilidadesInclude;
type ComDados = Prisma.replicabilidadesGetPayload<{ include: typeof comDados }>;

/** Com as fotos (em ordem) e o nome de quem publicou (`autor`). */
export type ReplicabilidadeRow = Omit<ComDados, 'usuario'> & { autor: { nome: string | null } };
const toRow = ({ usuario, ...r }: ComDados): ReplicabilidadeRow => ({ ...r, autor: { nome: usuario.profile?.nome ?? null } });

/** Publicar: professores e admin. A gestão (que na tela é só leitura) não publica. */
function assertPodePublicar(auth: SessionUser) {
  if (isGestao(auth.role) && auth.role !== 'admin') throw new HttpError(403, 'SEM_PERMISSAO', 'A gestão vê o mural, mas não publica.');
}

/** Alterar: quem publicou e o admin. Como todos veem, os outros recebem "sem permissão". */
async function buscarEditavel(auth: SessionUser, id: string) {
  const r = await prisma.replicabilidades.findUnique({ where: { id } });
  if (!r) throw registroNaoEncontrado();
  if (!podeEscrever(auth, r.user_id)) throw new HttpError(403, 'SEM_PERMISSAO', 'Só quem publicou pode alterar.');
  return r;
}

/** Todo usuário logado vê. Filtro opcional por autor. As mais novas primeiro. */
export async function listReplicabilidades(f: { user_id?: string }): Promise<ReplicabilidadeRow[]> {
  const [user_id] = listaDeIds(f.user_id, 'user_id', 1);
  const lista = await prisma.replicabilidades.findMany({ where: user_id ? { user_id } : {}, include: comDados, orderBy: { created_at: 'desc' } });
  return lista.map(toRow);
}

export async function getReplicabilidade(id: string): Promise<ReplicabilidadeRow> {
  const r = await prisma.replicabilidades.findUnique({ where: { id }, include: comDados });
  if (!r) throw registroNaoEncontrado();
  return toRow(r);
}

/** `{ titulo, descricao? }`. */
export async function createReplicabilidade(auth: SessionUser, body: unknown): Promise<ReplicabilidadeRow> {
  assertPodePublicar(auth);
  const titulo = requiredText(body, 'titulo')!;
  return toRow(await prisma.replicabilidades.create({ data: { titulo, descricao: optionalString(body, 'descricao'), user_id: auth.user.id }, include: comDados }));
}

export async function updateReplicabilidade(auth: SessionUser, id: string, body: unknown): Promise<ReplicabilidadeRow> {
  const dados = { titulo: requiredText(body, 'titulo', true), descricao: optionalString(body, 'descricao') };
  if (dados.titulo === undefined && dados.descricao === undefined) throw invalido('Informe pelo menos um campo para alterar.');
  await buscarEditavel(auth, id);
  return toRow(await prisma.replicabilidades.update({ where: { id }, data: dados, include: comDados }));
}

/** As fotos saem junto, do banco e do armazenamento. */
export async function deleteReplicabilidade(auth: SessionUser, id: string): Promise<void> {
  await buscarEditavel(auth, id);
  const fotos = await prisma.replicabilidade_fotos.findMany({ where: { replicabilidade_id: id }, select: { storage_path: true } });
  await prisma.replicabilidades.delete({ where: { id } });
  if (fotos.length) await armazenamento.excluir(BUCKET_FOTOS, fotos.map((f) => f.storage_path));
}

/** Corpo: a foto. Vai para o fim (ordem seguinte), na pasta de quem publicou. */
export async function enviarFoto(
  auth: SessionUser,
  id: string,
  dados: { nome: unknown; mime: string | undefined; conteudo: unknown },
): Promise<replicabilidade_fotos> {
  const r = await buscarEditavel(auth, id);
  const arquivo = await enviarArquivo(auth, BUCKET_FOTOS, { pasta: r.id, ...dados }, r.user_id);
  try {
    const ultima = await prisma.replicabilidade_fotos.aggregate({ where: { replicabilidade_id: id }, _max: { ordem: true } });
    return await prisma.replicabilidade_fotos.create({
      data: { replicabilidade_id: id, storage_path: arquivo.path, nome: arquivo.nome, ordem: (ultima._max.ordem ?? -1) + 1 },
    });
  } catch (err) {
    await armazenamento.excluir(BUCKET_FOTOS, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

export async function deleteFoto(auth: SessionUser, id: string, fotoId: string): Promise<void> {
  await buscarEditavel(auth, id);
  const foto = isUuid(fotoId) ? await prisma.replicabilidade_fotos.findFirst({ where: { id: fotoId, replicabilidade_id: id } }) : null;
  if (!foto) throw new HttpError(404, 'ARQUIVO_NAO_ENCONTRADO', 'Foto não encontrada.');
  await prisma.replicabilidade_fotos.delete({ where: { id: foto.id } });
  await armazenamento.excluir(BUCKET_FOTOS, [foto.storage_path]);
}
