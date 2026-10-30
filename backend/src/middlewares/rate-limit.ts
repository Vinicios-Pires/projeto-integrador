import rateLimit from 'express-rate-limit';
import { env } from '../lib/env';

const limitResponse = (message: string) => ({ error: { code: 'MUITAS_TENTATIVAS', message } });

/**
 * Contra quem fica chutando senhas: conta só os logins que *falharam*, então quem
 * acerta a senha nunca é bloqueado. Contagem por IP, em memória (uma instância só).
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.LOGIN_MAX_TENTATIVAS,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limitResponse('Muitas tentativas de login. Aguarde alguns minutos e tente de novo.'),
});

/** Contra criação de contas em massa. */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.CADASTRO_MAX_POR_HORA,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limitResponse('Muitos cadastros feitos daqui. Tente de novo mais tarde.'),
});
