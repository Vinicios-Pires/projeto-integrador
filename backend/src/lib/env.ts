import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente ${name} não definida (ver .env.example).`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const STORAGE_DRIVERS = ['local', 'supabase'] as const;

function storageDriver(): (typeof STORAGE_DRIVERS)[number] {
  const value = process.env.STORAGE_DRIVER?.trim() || 'local';
  if (!(STORAGE_DRIVERS as readonly string[]).includes(value)) {
    throw new Error(`STORAGE_DRIVER inválido: use ${STORAGE_DRIVERS.join(' ou ')}.`);
  }
  return value as (typeof STORAGE_DRIVERS)[number];
}

/** Variáveis de ambiente lidas uma única vez, com valores padrão seguros para dev. */
export const env = {
  PORT: Number(process.env.PORT ?? 3333),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN?.trim() || '8h',
  /** Só e-mails deste domínio podem se cadastrar. */
  ALLOWED_EMAIL_DOMAIN: (process.env.ALLOWED_EMAIL_DOMAIN?.trim() || 'prof.educacao.sp.gov.br').toLowerCase(),
  /** Quantos proxies há na frente da API (1 no Render), para o limite de tentativas ver o IP real. */
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
  /** Tentativas de login *erradas* por IP a cada 15 minutos. */
  LOGIN_MAX_TENTATIVAS: positiveInt('LOGIN_MAX_TENTATIVAS', 10),
  /** Cadastros por IP a cada hora. */
  CADASTRO_MAX_POR_HORA: positiveInt('CADASTRO_MAX_POR_HORA', 5),
  /** Onde os arquivos ficam: `local` (pasta no disco, para dev e testes) ou `supabase` (Storage). */
  STORAGE_DRIVER: storageDriver(),
  /** Pasta dos arquivos quando `STORAGE_DRIVER=local`. */
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR?.trim() || '.storage',
  /** Projeto do Supabase e chave de serviço, obrigatórios com `STORAGE_DRIVER=supabase`. */
  SUPABASE_URL: storageDriver() === 'supabase' ? required('SUPABASE_URL') : undefined,
  SUPABASE_SERVICE_ROLE_KEY: storageDriver() === 'supabase' ? required('SUPABASE_SERVICE_ROLE_KEY') : undefined,
};
