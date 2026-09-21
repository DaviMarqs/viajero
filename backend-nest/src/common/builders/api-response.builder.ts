import { Injectable, Scope } from '@nestjs/common';
import { ApiSuccessResponse } from '../interfaces/api-response.interface';

@Injectable({ scope: Scope.TRANSIENT })
export class ApiResponseBuilder {
  private message = 'Operacao realizada com sucesso.';

  withMessage(message: string): this {
    this.message = message;
    return this;
  }

  build<T>(data: T): ApiSuccessResponse<T> {
    return {
      success: true,
      message: this.message,
      data,
    };
  }
}
