import { ArgumentsHost, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiExceptionFilter, resolveErrorMessage } from '../api-exception.filter';

function hostFor(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
}

describe('resolveErrorMessage', () => {
  it('troca mensagens padrao do framework por PT', () => {
    expect(resolveErrorMessage(401, { message: 'Unauthorized', statusCode: 401 })).toBe('Sessao expirada ou nao autenticada. Entre novamente.');
    expect(resolveErrorMessage(404, { message: 'Cannot POST /api/x', error: 'Not Found', statusCode: 404 })).toBe('Recurso nao encontrado.');
    expect(resolveErrorMessage(413, { message: 'File too large', error: 'Payload Too Large', statusCode: 413 })).toBe('Arquivo muito grande. O limite e 2 MB.');
    expect(resolveErrorMessage(400, { message: 'Validation failed (numeric string is expected)', statusCode: 400 })).toBe('Dados invalidos. Verifique os campos enviados.');
  });

  it('resume erros do class-validator', () => {
    expect(resolveErrorMessage(400, { message: ['rating must not be greater than 5'], statusCode: 400 })).toBe('Dados invalidos. Verifique os campos enviados.');
  });

  it('mantem mensagens lancadas pelo dominio', () => {
    expect(resolveErrorMessage(404, { message: 'Roteiro nao encontrado.', error: 'Not Found', statusCode: 404 })).toBe('Roteiro nao encontrado.');
    expect(resolveErrorMessage(500, { message: 'Nao foi possivel gerar o roteiro. Tente novamente.', statusCode: 500 })).toBe('Nao foi possivel gerar o roteiro. Tente novamente.');
  });

  it('usa mensagem generica para 5xx sem mensagem de dominio', () => {
    expect(resolveErrorMessage(500, undefined)).toBe('Nao foi possivel processar a solicitacao.');
    expect(resolveErrorMessage(500, { message: 'Internal Server Error', statusCode: 500 })).toBe('Nao foi possivel processar a solicitacao.');
  });
});

describe('ApiExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  function run(exception: unknown) {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new ApiExceptionFilter().catch(exception, hostFor(response));
    return { status: response.status.mock.calls[0][0] as number, body: response.json.mock.calls[0][0] as Record<string, unknown> };
  }

  it('nao expoe detalhes de erros inesperados', () => {
    const { status, body } = run(new Error('null value in column "date_joined" violates not-null constraint'));
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, message: 'Nao foi possivel processar a solicitacao.', errors: {} });
  });

  it('mantem o corpo de erros 4xx em errors', () => {
    const { status, body } = run(new NotFoundException('Roteiro nao encontrado.'));
    expect(status).toBe(404);
    expect(body.message).toBe('Roteiro nao encontrado.');
    expect(body.errors).toMatchObject({ message: 'Roteiro nao encontrado.' });
  });

  it('traduz 401 do passport', () => {
    expect(run(new UnauthorizedException()).body.message).toBe('Sessao expirada ou nao autenticada. Entre novamente.');
  });

  it('5xx com mensagem de dominio chega a UI sem detalhes', () => {
    const { body } = run(new InternalServerErrorException('Nao foi possivel gerar o roteiro. Tente novamente.'));
    expect(body).toEqual({ success: false, message: 'Nao foi possivel gerar o roteiro. Tente novamente.', errors: {} });
  });
});
