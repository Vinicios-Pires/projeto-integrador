import type { app_role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { HttpError } from '../../lib/http-error';
import { env } from '../../lib/env';

export type ProfileStatus = 'pendente' | 'ativo' | 'inativo';

/** Formato devolvido por /auth/login e /me — espelha o que o AuthContext do frontend usa. */
export interface SessionUser {
  user: { id: string; email: string };
  role: app_role | null;
  profile: { nome: string; email: string; status: ProfileStatus } | null;
  deve_trocar_senha: boolean;
}

/**
 * O frontend trabalha com um único papel por usuário. Se houver mais de um em
 * `user_roles`, vale o de maior permissão.
 */
const ROLE_PRIORITY: app_role[] = ['admin', 'direcao', 'vice_direcao', 'coordenador', 'professor'];

export function primaryRole(roles: app_role[]): app_role | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}

export const MIN_PASSWORD_LENGTH = 8;
/** O bcrypt ignora o que passa de 72 bytes; acima disso a senha seria cortada em silêncio. */
export const MAX_PASSWORD_BYTES = 72;
const MAX_NOME_LENGTH = 120;

function assertPasswordRules(senha: string): void {
  if (senha.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 'SENHA_FRACA', `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (Buffer.byteLength(senha, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new HttpError(400, 'SENHA_LONGA', 'A senha é longa demais (máximo de 72 caracteres).');
  }
}

/** Hash fixo usado quando o e-mail não existe, para o tempo de resposta não denunciar isso. */
let dummyHash: Promise<string> | undefined;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    include: { profile: true, user_roles: true },
  });
  if (!usuario) return null;

  return {
    user: { id: usuario.id, email: usuario.email },
    role: primaryRole(usuario.user_roles.map((r) => r.role)),
    profile: usuario.profile
      ? {
          nome: usuario.profile.nome,
          email: usuario.profile.email,
          status: usuario.profile.status as ProfileStatus,
        }
      : null,
    deve_trocar_senha: usuario.deve_trocar_senha,
  };
}

/** Barra contas que não estão ativas. Usado no login e em toda requisição autenticada. */
export function assertActive(session: SessionUser): void {
  const status = session.profile?.status;
  if (status === 'ativo') return;
  if (status === 'pendente') {
    throw new HttpError(403, 'CONTA_PENDENTE', 'Seu cadastro ainda está aguardando aprovação.');
  }
  throw new HttpError(403, 'CONTA_INATIVA', 'Sua conta está inativa. Procure a administração.');
}

export async function login(email: string, senha: string): Promise<SessionUser> {
  const usuario = await prisma.usuarios.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, senha_hash: true },
  });

  dummyHash ??= hashPassword('senha-inexistente');
  const ok = await verifyPassword(senha, usuario?.senha_hash ?? (await dummyHash));
  if (!usuario || !ok) {
    throw new HttpError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  }

  const session = await loadSessionUser(usuario.id);
  if (!session) throw new HttpError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  assertActive(session);
  return session;
}

export async function changePassword(userId: string, senhaAtual: string, novaSenha: string) {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: { senha_hash: true },
  });
  if (!usuario || !(await verifyPassword(senhaAtual, usuario.senha_hash))) {
    throw new HttpError(400, 'SENHA_ATUAL_INCORRETA', 'A senha atual está incorreta.');
  }
  assertPasswordRules(novaSenha);
  if (novaSenha === senhaAtual) {
    throw new HttpError(400, 'SENHA_REPETIDA', 'A nova senha precisa ser diferente da atual.');
  }

  await prisma.usuarios.update({
    where: { id: userId },
    data: { senha_hash: await hashPassword(novaSenha), deve_trocar_senha: false },
  });
}

/**
 * Cadastro: só e-mail institucional. A conta nasce `pendente`, com papel de professor,
 * e só entra depois que o admin aprovar. O primeiro admin vem do seed, nunca daqui.
 */
export async function signup(nome: string, email: string, senha: string): Promise<SessionUser> {
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  if (!nomeLimpo || nomeLimpo.length > MAX_NOME_LENGTH) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `Informe seu nome (até ${MAX_NOME_LENGTH} caracteres).`);
  }

  const emailNorm = normalizeEmail(email);
  const [local, domain, ...resto] = emailNorm.split('@');
  if (!local || !domain || resto.length > 0 || /\s/.test(emailNorm)) {
    throw new HttpError(400, 'EMAIL_INVALIDO', 'E-mail inválido.');
  }
  if (domain !== env.ALLOWED_EMAIL_DOMAIN) {
    throw new HttpError(
      400,
      'DOMINIO_NAO_PERMITIDO',
      `Apenas e-mails @${env.ALLOWED_EMAIL_DOMAIN} podem se cadastrar.`,
    );
  }
  assertPasswordRules(senha);

  const senha_hash = await hashPassword(senha);
  try {
    const usuario = await prisma.usuarios.create({
      data: {
        email: emailNorm,
        senha_hash,
        profile: { create: { nome: nomeLimpo, email: emailNorm, status: 'pendente' } },
        user_roles: { create: { role: 'professor' } },
      },
      select: { id: true },
    });
    return (await loadSessionUser(usuario.id))!;
  } catch (err) {
    // P2002 = violação de unicidade (e-mail já cadastrado), inclusive em cadastros simultâneos.
    if ((err as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já está cadastrado. Tente entrar.');
    }
    throw err;
  }
}
