export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  NOT_FOUND: 2,
  CONFLICT: 3,
  VALIDATION_ERROR: 4,
  STORAGE_ERROR: 5,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
