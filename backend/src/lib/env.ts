import 'dotenv/config';

/** Variáveis de ambiente lidas uma única vez, com valores padrão seguros para dev. */
export const env = {
  PORT: Number(process.env.PORT ?? 3333),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
