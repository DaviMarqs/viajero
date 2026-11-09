import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

export const STAFF_ONLY_MESSAGE = 'Apenas administradores podem realizar esta acao.';

type StaffFlags = Pick<AuthenticatedUser, 'is_staff' | 'is_superuser'>;

/** Equivale ao IsAdminUser do Django (is_staff), com superusuario tambem liberado. */
export function isStaffUser(user: StaffFlags | null | undefined): boolean {
  return Boolean(user && (user.is_staff || user.is_superuser));
}

export function requireStaff(user: StaffFlags | null | undefined, message = STAFF_ONLY_MESSAGE): void {
  if (!isStaffUser(user)) throw new ForbiddenException(message);
}

/** O proprio usuario ou staff (o Django deixava `/api/users/:id` aberto com AllowAny). */
export function canManageUser(actor: Pick<AuthenticatedUser, 'id'> & StaffFlags, targetUserId: number): boolean {
  return Number(actor.id) === Number(targetUserId) || isStaffUser(actor);
}

/** Use depois do JwtAuthGuard: `@UseGuards(JwtAuthGuard, StaffGuard)`. */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    requireStaff(request.user);
    return true;
  }
}
