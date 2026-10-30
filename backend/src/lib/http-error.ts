/**
 * Erro com status HTTP e código estável, que o frontend pode usar para decidir
 * o que mostrar (ex.: CONTA_PENDENTE → tela "aguardando aprovação").
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
