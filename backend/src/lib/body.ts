import { HttpError } from './http-error';

const campo = (body: unknown, field: string) => (body as Record<string, unknown> | undefined)?.[field];
const invalido = (message: string) => new HttpError(400, 'DADOS_INVALIDOS', message);

/** Lê um campo de texto obrigatório do corpo da requisição. */
export function requiredString(body: unknown, field: string): string {
  const value = campo(body, field);
  if (typeof value !== 'string' || value === '') {
    throw invalido(`O campo "${field}" é obrigatório.`);
  }
  return value;
}

/** Texto opcional: `undefined` se não veio, `null` se veio nulo ou vazio. */
export function optionalString(body: unknown, field: string): string | null | undefined {
  const value = campo(body, field);
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw invalido(`O campo "${field}" deve ser um texto.`);
  return value;
}

/**
 * Texto obrigatório e sem espaços nas pontas. Em edição (`parcial`), pode não vir
 * (`undefined`), mas se vier não pode ser vazio.
 */
export function requiredText(body: unknown, field: string, parcial = false): string | undefined {
  const value = optionalString(body, field);
  if (value === undefined && parcial) return undefined;
  if (!value?.trim()) throw invalido(`O campo "${field}" é obrigatório.`);
  return value.trim();
}

/** Uma das opções permitidas: `undefined` se não veio; nulo ou fora da lista é erro. */
export function optionalChoice(body: unknown, field: string, opcoes: readonly string[]): string | undefined {
  const value = optionalString(body, field);
  if (value === undefined) return undefined;
  if (value === null || !opcoes.includes(value)) throw invalido(`"${field}" inválido. Use: ${opcoes.join(', ')}.`);
  return value;
}

/** Número inteiro opcional, dentro de [min, max]: `undefined` se não veio, `null` se veio nulo. */
export function optionalInt(body: unknown, field: string, min: number, max: number): number | null | undefined {
  const value = campo(body, field);
  if (value === undefined || value === null) return value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalido(`O campo "${field}" deve ser um número inteiro entre ${min} e ${max}.`);
  }
  return value;
}

/** Sim/não opcional: `undefined` se não veio. */
export function optionalBoolean(body: unknown, field: string): boolean | undefined {
  const value = campo(body, field);
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalido(`O campo "${field}" deve ser true ou false.`);
  return value;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data opcional no formato `AAAA-MM-DD`: `undefined` se não veio, `null` se veio nula ou vazia. */
export function optionalDate(body: unknown, field: string): Date | null | undefined {
  const value = optionalString(body, field);
  if (value === undefined || value === null) return value;
  const data = new Date(`${value}T00:00:00Z`);
  if (!DATA.test(value) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== value) {
    throw invalido(`O campo "${field}" deve ser uma data no formato AAAA-MM-DD.`);
  }
  return data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id da URL que não é um UUID nunca existe no banco — responde 404 sem consultar. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
