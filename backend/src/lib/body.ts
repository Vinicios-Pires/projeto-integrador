import { HttpError } from './http-error';

/** Lê um campo de texto obrigatório do corpo da requisição. */
export function requiredString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(400, 'DADOS_INVALIDOS', `O campo "${field}" é obrigatório.`);
  }
  return value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id da URL que não é um UUID nunca existe no banco — responde 404 sem consultar. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
