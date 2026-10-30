import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Rotas publicas que mudam com o usuario: com token valido preenche `request.user`, sem token segue anonimo. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_error: unknown, user: TUser | false): TUser | undefined {
    return user || undefined;
  }
}
