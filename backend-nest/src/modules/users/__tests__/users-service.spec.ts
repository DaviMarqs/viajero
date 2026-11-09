import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';

const actor = (id: number, is_staff = false) => ({ id, email: `u${id}@x.dev`, username: `u${id}`, is_staff, is_superuser: false });

describe('UsersService: /api/users/:id', () => {
  const users = { findOne: jest.fn(), exists: jest.fn(), save: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new UsersService(users as never, {} as never, audit as never);

  beforeEach(() => {
    jest.resetAllMocks();
    users.save.mockImplementation(async (user) => user);
    users.exists.mockResolvedValue(false);
  });

  it('usuario comum nao acessa outra conta (403) nem consulta o banco', async () => {
    await expect(service.findManageable(actor(1), 2)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateProfile(actor(1), 2, { display_name: 'x' })).rejects.toThrow('Voce nao tem permissao para acessar este usuario.');
    expect(users.findOne).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('staff acessa qualquer conta; conta inexistente responde 404', async () => {
    users.findOne.mockResolvedValueOnce({ id: 2, email: 'u2@x.dev', username: 'u2' });
    await expect(service.findManageable(actor(1, true), 2)).resolves.toMatchObject({ id: 2 });
    users.findOne.mockResolvedValueOnce(null);
    await expect(service.findManageable(actor(1, true), 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza a propria conta e audita user.profile_updated com os campos enviados', async () => {
    users.findOne.mockResolvedValue({ id: 1, email: 'u1@x.dev', username: 'u1', display_name: 'Antigo' });
    const updated = await service.updateProfile(actor(1), 1, { display_name: 'Novo' });
    expect(updated.display_name).toBe('Novo');
    expect(audit.log).toHaveBeenCalledWith({ event_type: 'user.profile_updated', actor_id: 1, content_type: 'User', object_id: '1', metadata: { display_name: 'Novo' } });
  });

  it('staff editando outra conta fica registrado como ator', async () => {
    users.findOne.mockResolvedValue({ id: 2, email: 'u2@x.dev', username: 'u2' });
    await service.updateProfile(actor(9, true), 2, { first_name: 'Ana' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actor_id: 9, object_id: '2' }));
  });

  it('email ou username de outra conta responde 400 em vez de erro do banco', async () => {
    users.findOne.mockResolvedValue({ id: 1, email: 'u1@x.dev', username: 'u1' });
    users.exists.mockResolvedValueOnce(true);
    await expect(service.updateProfile(actor(1), 1, { email: 'OUTRO@x.dev' })).rejects.toThrow('Ja existe um usuario cadastrado com este email.');
    users.exists.mockResolvedValueOnce(true);
    await expect(service.updateProfile(actor(1), 1, { username: 'u2' })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('reenviar o proprio email (mesmo com outra caixa) nao consulta duplicidade', async () => {
    users.findOne.mockResolvedValue({ id: 1, email: 'u1@x.dev', username: 'u1' });
    await service.updateProfile(actor(1), 1, { email: 'U1@x.dev', username: 'u1' });
    expect(users.exists).not.toHaveBeenCalled();
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'u1@x.dev' }));
  });
});
