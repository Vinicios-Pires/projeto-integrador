import { HttpError } from './http-error';
import { isGestao } from '../middlewares/roles';
import type { SessionUser } from '../modules/auth/auth.service';

/**
 * Padrão A do PRD (§3.1): cada professor mexe só no que é seu, a gestão vê tudo
 * (só leitura) e o admin pode tudo. `donoId` é o `user_id` da linha.
 */
export function podeLer(auth: SessionUser, donoId: string | null): boolean {
  return isGestao(auth.role) || donoId === auth.user.id;
}

export function podeEscrever(auth: SessionUser, donoId: string | null): boolean {
  return auth.role === 'admin' || donoId === auth.user.id;
}

/** Filtro de listagem do padrão A: a gestão vê tudo, o professor só o que é seu. */
export function filtroLeitura(auth: SessionUser): { user_id?: string } {
  return isGestao(auth.role) ? {} : { user_id: auth.user.id };
}

/**
 * Confere o padrão A para alterar uma linha: quem não pode nem ver recebe o 404 de
 * `naoEncontrado` (como se a linha não existisse); quem só pode ver (gestão) recebe 403.
 */
export function exigirEscrita(auth: SessionUser, donoId: string | null, naoEncontrado: () => HttpError, mensagem: string) {
  if (!podeLer(auth, donoId)) throw naoEncontrado();
  if (!podeEscrever(auth, donoId)) throw new HttpError(403, 'SEM_PERMISSAO', mensagem);
}
