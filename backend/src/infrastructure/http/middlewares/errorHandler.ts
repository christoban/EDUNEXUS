import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${error.name} : ${error.message}`);

  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue',
    ...(process.env.NODE_ENV === 'development' && {
      detail: error.message,
      stack: error.stack,
    }),
  });
}
