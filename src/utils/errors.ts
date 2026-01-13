import { EXIT_CODES, type ExitCode } from "./exit-codes.js";

export class ClaudiaError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = EXIT_CODES.GENERAL_ERROR
  ) {
    super(message);
    this.name = "ClaudiaError";
  }
}

export class NotFoundError extends ClaudiaError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, EXIT_CODES.NOT_FOUND);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ClaudiaError {
  constructor(message: string) {
    super(message, EXIT_CODES.VALIDATION_ERROR);
    this.name = "ValidationError";
  }
}

export class ConflictError extends ClaudiaError {
  constructor(message: string) {
    super(message, EXIT_CODES.CONFLICT);
    this.name = "ConflictError";
  }
}

export class StorageError extends ClaudiaError {
  constructor(message: string) {
    super(message, EXIT_CODES.STORAGE_ERROR);
    this.name = "StorageError";
  }
}
