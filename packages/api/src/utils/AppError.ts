/**
 * Custom application error class with HTTP status code.
 * Thrown by services/controllers and caught by the global error handler.
 *
 * @example
 * throw new AppError('User not found', 404);
 * throw new AppError('Invalid OTP', 400);
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';

    // Capture proper stack trace (excludes constructor call from it)
    Error.captureStackTrace(this, this.constructor);
  }
}
