import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Dados invalidos. Verifique os campos enviados.',
  401: 'Sessao expirada ou nao autenticada. Entre novamente.',
  403: 'Voce nao tem permissao para esta acao.',
  404: 'Recurso nao encontrado.',
  409: 'A solicitacao conflita com o estado atual do recurso.',
  413: 'Arquivo muito grande. O limite e 2 MB.',
};
const SERVER_ERROR_MESSAGE = 'Nao foi possivel processar a solicitacao.';

// Mensagens padrao (em ingles) do Nest, Passport, pipes e Multer, que nao devem chegar a UI.
const FRAMEWORK_MESSAGES = [
  /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) /,
  /^Validation failed/,
  /^Multipart: /,
  /^(Unauthorized|Forbidden|Forbidden resource|Not Found|Bad Request|Conflict|Payload Too Large|Internal Server Error|File too large|Too many files|Too many fields|Too many parts|Field name too long|Field value too long|Field name missing|Unexpected field)$/,
];

export function resolveErrorMessage(status: number, raw: unknown): string {
  const fallback = status >= 500 ? SERVER_ERROR_MESSAGE : STATUS_MESSAGES[status] ?? SERVER_ERROR_MESSAGE;
  const message =
    typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null && 'message' in raw ? (raw as { message: unknown }).message : undefined;
  if (typeof message !== 'string' || !message.trim()) return fallback;
  return FRAMEWORK_MESSAGES.some((pattern) => pattern.test(message)) ? fallback : message;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      message: resolveErrorMessage(status, raw),
      errors: status >= 500 ? {} : typeof raw === 'object' && raw !== null ? raw : { detail: raw },
    });
  }
}
