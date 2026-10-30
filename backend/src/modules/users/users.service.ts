import { $Enums, type app_role, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { generateTempPassword, hashPassword } from '../../lib/password';
import { primaryRole, type ProfileStatus } from '../auth/auth.service';

/** Uma linha da tela "Gerenciar Usuários" (mesmos campos que ela já usa, mais alguns úteis). */
export interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  status: ProfileStatus;
  role: app_role | null;
  deve_trocar_senha: boolean;
  created_at: Date;
}

const STATUS_FILTRO: ProfileStatus[] = ['pendente', 'ativo', 'inativo'];
/** O admin só aprova/reativa (`ativo`) ou inativa. Ninguém volta a ficar "pendente". */
const STATUS_ALTERAVEL: ProfileStatus[] = ['ativo', 'inativo'];
export const ROLES = Object.values($Enums.app_role);

const rowInclude = { profile: true, user_roles: true } satisfies Prisma.usuariosInclude;
type UsuarioComDados = Prisma.usuariosGetPayload<{ include: typeof rowInclude }>;

function toRow(u: UsuarioComDados): UsuarioRow {
  return {
    id: u.id,
    nome: u.profile?.nome ?? '',
    email: u.email,
    status: (u.profile?.status ?? 'pendente') as ProfileStatus,
    role: primaryRole(u.user_roles.map((r) => r.role)),
    deve_trocar_senha: u.deve_trocar_senha,
    created_at: u.created_at,
  };
}

const naoEncontrado = () => new HttpError(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');

async function findRow(id: string): Promise<UsuarioRow> {
  const u = await prisma.usuarios.findUnique({ where: { id }, include: rowInclude });
  if (!u) throw naoEncontrado();
  return toRow(u);
}

/**
 * O admin não pode inativar, rebaixar nem resetar a si mesmo pela gestão de usuários.
 * Isso também garante que sempre sobra pelo menos um admin ativo: quem está fazendo a ação.
 */
function assertNotSelf(adminId: string, alvoId: string, acao: string) {
  if (adminId === alvoId) {
    throw new HttpError(400, 'ACAO_EM_SI_MESMO', `Você não pode ${acao} a sua própria conta.`);
  }
}

/** Lista para a tela de gestão: mais recentes primeiro, com filtro por status e busca por nome/e-mail. */
export async function listUsers(filtros: { status?: string; busca?: string }): Promise<UsuarioRow[]> {
  if (filtros.status && !STATUS_FILTRO.includes(filtros.status as ProfileStatus)) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `Status inválido. Use: ${STATUS_FILTRO.join(', ')}.`);
  }
  const busca = filtros.busca?.trim();

  const usuarios = await prisma.usuarios.findMany({
    where: {
      ...(filtros.status ? { profile: { status: filtros.status } } : {}),
      ...(busca
        ? {
            OR: [
              { email: { contains: busca, mode: 'insensitive' } },
              { profile: { nome: { contains: busca, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: rowInclude,
    orderBy: { created_at: 'desc' },
  });
  return usuarios.map(toRow);
}

/** Aprovar (pendente → ativo), inativar ou reativar. */
export async function setStatus(adminId: string, id: string, status: string): Promise<UsuarioRow> {
  if (!STATUS_ALTERAVEL.includes(status as ProfileStatus)) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `Status inválido. Use: ${STATUS_ALTERAVEL.join(', ')}.`);
  }
  assertNotSelf(adminId, id, status === 'inativo' ? 'inativar' : 'alterar o status de');

  const { count } = await prisma.profiles.updateMany({ where: { id }, data: { status } });
  if (count === 0) throw naoEncontrado();
  return findRow(id);
}

/** Troca o papel. Cada pessoa fica com exatamente um papel (como a tela trabalha). */
export async function setRole(adminId: string, id: string, role: string): Promise<UsuarioRow> {
  if (!ROLES.includes(role as app_role)) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `Papel inválido. Use: ${ROLES.join(', ')}.`);
  }
  assertNotSelf(adminId, id, 'trocar o papel de');

  await prisma.$transaction(async (tx) => {
    if (!(await tx.usuarios.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    await tx.user_roles.deleteMany({ where: { user_id: id } });
    await tx.user_roles.create({ data: { user_id: id, role: role as app_role } });
  });
  return findRow(id);
}

/**
 * Gera uma senha temporária para o admin repassar (sem e-mail automático, decisão do PRD).
 * A pessoa é obrigada a trocá-la no próximo acesso. Como a senha antiga deixa de valer,
 * sessões já abertas também ficam presas na tela de troca de senha.
 */
export async function resetPassword(adminId: string, id: string): Promise<{ usuario: UsuarioRow; senha_temporaria: string }> {
  assertNotSelf(adminId, id, 'resetar a senha de');

  const senha_temporaria = generateTempPassword();
  const { count } = await prisma.usuarios.updateMany({
    where: { id },
    data: { senha_hash: await hashPassword(senha_temporaria), deve_trocar_senha: true },
  });
  if (count === 0) throw naoEncontrado();
  return { usuario: await findRow(id), senha_temporaria };
}
