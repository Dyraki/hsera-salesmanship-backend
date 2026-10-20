export class AppError extends Error {
  public readonly status: number;
  public readonly errors?: any;

  constructor(message: string, status = 400, errors?: any) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, errors?: any): AppError {
    return new AppError(message, 400, errors);
  }

  static unauthorized(message = 'Autentikasi diperlukan.'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Akses ditolak.'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Data tidak ditemukan.'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }
}
