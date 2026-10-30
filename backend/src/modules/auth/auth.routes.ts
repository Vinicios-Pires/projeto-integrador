import { Router } from 'express';
import { signToken } from '../../lib/jwt';
import { requiredString } from '../../lib/body';
import { requireAuth } from '../../middlewares/auth';
import { loginLimiter, signupLimiter } from '../../middlewares/rate-limit';
import { changePassword, login, signup } from './auth.service';

export const authRouter = Router();

/** Entrar: troca e-mail + senha por um token. */
authRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const email = requiredString(req.body, 'email');
  const senha = requiredString(req.body, 'senha');

  const session = await login(email, senha);
  res.json({ token: signToken(session.user.id), ...session });
});

/**
 * Cadastro: cria a conta como `pendente` (sem token — só entra depois da aprovação do admin).
 * Mesmo formato do /me, para a tela mostrar "aguardando aprovação".
 */
authRouter.post('/auth/signup', signupLimiter, async (req, res) => {
  const nome = requiredString(req.body, 'nome');
  const email = requiredString(req.body, 'email');
  const senha = requiredString(req.body, 'senha');

  res.status(201).json(await signup(nome, email, senha));
});

/** Quem sou eu: dados do dono do token (usado pelo frontend ao abrir o app). */
authRouter.get('/me', requireAuth({ allowTempPassword: true }), (req, res) => {
  res.json(req.auth);
});

/** Trocar a própria senha. Também é o caminho para sair da senha temporária. */
authRouter.post('/auth/change-password', requireAuth({ allowTempPassword: true }), async (req, res) => {
  const senhaAtual = requiredString(req.body, 'senha_atual');
  const novaSenha = requiredString(req.body, 'nova_senha');

  await changePassword(req.auth!.user.id, senhaAtual, novaSenha);
  res.status(204).end();
});
