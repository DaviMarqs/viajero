import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : exception instanceof QueryFailedError ? exception.message : 'Internal server error';
    const errors = typeof raw === 'object' && raw !== null ? raw : { detail: raw };
    const message = status >= 500 ? 'Nao foi possivel processar a solicitacao.' : this.extractMessage(raw);

    response.status(status).json({
      success: false,
      message,
      errors,
    });
  }

  private extractMessage(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && 'message' in raw) {
      const value = (raw as { message: unknown }).message;
      return Array.isArray(value) ? value.join(', ') : String(value);
    }
    return 'Nao foi possivel processar a solicitacao.';
  }
}
