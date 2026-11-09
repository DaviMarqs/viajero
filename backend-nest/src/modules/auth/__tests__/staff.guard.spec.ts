import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { canManageUser, isStaffUser, requireStaff, StaffGuard, STAFF_ONLY_MESSAGE } from '../staff.guard';

const user = (flags: Partial<{ id: number; is_staff: boolean; is_superuser: boolean }> = {}) => ({
  id: flags.id ?? 1,
  email: 'a@b.dev',
  username: 'a',
  is_staff: flags.is_staff ?? false,
  is_superuser: flags.is_superuser ?? false,
});

const contextFor = (requestUser: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }) }) as unknown as ExecutionContext;

describe('regras de staff', () => {
  it('staff e superusuario sao administradores; usuario comum e anonimo nao', () => {
    expect(isStaffUser(user({ is_staff: true }))).toBe(true);
    expect(isStaffUser(user({ is_superuser: true }))).toBe(true);
    expect(isStaffUser(user())).toBe(false);
    expect(isStaffUser(undefined)).toBe(false);
  });

  it('requireStaff lanca 403 com a mensagem informada', () => {
    expect(() => requireStaff(user({ is_staff: true }))).not.toThrow();
    expect(() => requireStaff(user())).toThrow(STAFF_ONLY_MESSAGE);
    expect(() => requireStaff(user(), 'Mensagem propria.')).toThrow('Mensagem propria.');
  });

  it('StaffGuard bloqueia quem nao e staff', () => {
    const guard = new StaffGuard();
    expect(guard.canActivate(contextFor(user({ is_staff: true })))).toBe(true);
    expect(() => guard.canActivate(contextFor(user()))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('usuario so gerencia a propria conta; staff gerencia qualquer uma', () => {
    expect(canManageUser(user({ id: 5 }), 5)).toBe(true);
    expect(canManageUser(user({ id: 5 }), '5' as unknown as number)).toBe(true);
    expect(canManageUser(user({ id: 5 }), 6)).toBe(false);
    expect(canManageUser(user({ id: 5, is_staff: true }), 6)).toBe(true);
  });
});
