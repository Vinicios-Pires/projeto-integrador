import type { plano_anexos } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { isUuid } from '../../lib/body';
import { podeLer } from '../../lib/acesso';
import type { SessionUser } from '../auth/auth.service';
import { armazenamento, enviarArquivo } from '../files/files.service';
import { BUCKET_ANEXOS, buscarPlanoEditavel, planoNaoEncontrado } from './planos.service';

// ===== Anexos dos planos: documentos e atividades adaptadas, guardados pelo correio de arquivos =====

/** `documento` (material da aula) ou `adaptada` (atividade adaptada), as duas colunas da planilha. */
export const TIPOS_ANEXO = ['documento', 'adaptada'];
const anexoNaoEncontrado = () => new HttpError(404, 'ANEXO_NAO_ENCONTRADO', 'Anexo não encontrado.');

export type AnexoRow = Omit<plano_anexos, 'tamanho_bytes'> & { tamanho_bytes: number | null };
const toAnexo = (a: plano_anexos): AnexoRow => ({ ...a, tamanho_bytes: a.tamanho_bytes === null ? null : Number(a.tamanho_bytes) });

function lerTipo(valor: unknown, obrigatorio: boolean): string | undefined {
  if (valor === undefined && !obrigatorio) return undefined;
  if (typeof valor !== 'string' || !TIPOS_ANEXO.includes(valor)) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `"tipo" deve ser ${TIPOS_ANEXO.join(' ou ')}.`);
  }
  return valor;
}

/** Dono e gestão veem. Filtro opcional por `tipo`. O link para abrir sai de `/files/plano-anexos/url`. */
export async function listAnexos(auth: SessionUser, plano_id: string, tipo?: unknown): Promise<AnexoRow[]> {
  const plano = await prisma.planos_aula.findUnique({ where: { id: plano_id }, select: { user_id: true } });
  if (!plano || !podeLer(auth, plano.user_id)) throw planoNaoEncontrado();
  const t = lerTipo(tipo, false);
  const lista = await prisma.plano_anexos.findMany({ where: { plano_id, ...(t ? { tipo: t } : {}) }, orderBy: { created_at: 'asc' } });
  return lista.map(toAnexo);
}

/**
 * Corpo: o próprio arquivo (como no correio de arquivos), `?tipo=documento|adaptada&nome=...`.
 * Fica na pasta do professor dono do plano, mesmo quando o admin envia. Planilha validada não recebe.
 */
export async function enviarAnexo(
  auth: SessionUser,
  plano_id: string,
  dados: { tipo: unknown; nome: unknown; mime: string | undefined; conteudo: unknown },
): Promise<AnexoRow> {
  const plano = await buscarPlanoEditavel(auth, plano_id);
  const tipo = lerTipo(dados.tipo, true)!;
  const arquivo = await enviarArquivo(auth, BUCKET_ANEXOS, { pasta: plano.id, nome: dados.nome, mime: dados.mime, conteudo: dados.conteudo }, plano.user_id);
  try {
    const anexo = await prisma.plano_anexos.create({
      data: {
        plano_id,
        user_id: plano.user_id,
        nome_arquivo: arquivo.nome,
        storage_path: arquivo.path,
        mime_type: arquivo.mime_type,
        tamanho_bytes: arquivo.tamanho_bytes,
        tipo,
      },
    });
    return toAnexo(anexo);
  } catch (err) {
    // Sem a linha no banco, o arquivo ficaria perdido no armazenamento.
    await armazenamento.excluir(BUCKET_ANEXOS, [arquivo.path]).catch(() => undefined);
    throw err;
  }
}

/** Apaga a linha e o arquivo. Só o dono (ou o admin), com a planilha aberta. */
export async function deleteAnexo(auth: SessionUser, plano_id: string, anexo_id: string): Promise<void> {
  await buscarPlanoEditavel(auth, plano_id);
  const anexo = isUuid(anexo_id) ? await prisma.plano_anexos.findFirst({ where: { id: anexo_id, plano_id } }) : null;
  if (!anexo) throw anexoNaoEncontrado();
  await prisma.plano_anexos.delete({ where: { id: anexo.id } });
  await armazenamento.excluir(BUCKET_ANEXOS, [anexo.storage_path]);
}
