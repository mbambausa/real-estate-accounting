// src/utils/errors.ts
export enum ErrorCode {
  DATABASE_ERROR = 'database_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  NOT_FOUND = 'not_found',
  BAD_REQUEST = 'bad_request',
  SERVER_ERROR = 'server_error'
}

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: any;

  constructor(code: ErrorCode, message: string, status: number = 500, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  console.error('Unhandled error:', error);
  return new AppError(
    ErrorCode.SERVER_ERROR,
    'An unexpected error occurred',
    500
  );
}