// src/domain/shared/errors.ts

export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Acesso negado. Contexto de tenant inválido.') {
    super(message, 401);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} não encontrado.`, 404);
  }
}