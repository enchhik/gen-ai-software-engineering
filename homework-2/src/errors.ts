import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = []
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: err.errors,
      },
    });
    return;
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', details: [] },
  });
}
