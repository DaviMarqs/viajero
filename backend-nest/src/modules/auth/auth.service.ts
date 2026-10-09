import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { DjangoPasswordAdapter } from '../../common/adapters/django-password.adapter';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { presentUser } from '../users/user.presenter';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly passwords: DjangoPasswordAdapter,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException({
        message: 'Ja existe um usuario cadastrado com este email.',
        email: ['Ja existe um usuario cadastrado com este email.'],
      });
    }
    const user = await this.users.create(dto);
    await this.audit.log({ event_type: 'user.registered', actor_id: user.id, content_type: 'User', object_id: String(user.id) });
    return this.buildPayload(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !this.passwords.verify(dto.password, user.password)) {
      throw new BadRequestException({ detail: 'Email ou senha invalidos.', message: 'Email ou senha invalidos.' });
    }
    await this.audit.log({ event_type: 'user.logged_in', actor_id: user.id, content_type: 'User', object_id: String(user.id) });
    return this.buildPayload(user);
  }

  async logout(userId: number) {
    await this.audit.log({ event_type: 'user.logged_out', actor_id: userId, content_type: 'User', object_id: String(userId) });
  }

  private buildPayload(user: Awaited<ReturnType<UsersService['create']>>) {
    const payload = {
      sub: Number(user.id),
      email: user.email,
      username: user.username,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
    };
    return {
      access: this.jwt.sign(payload),
      refresh: this.jwt.sign(payload, { expiresIn: '30d' }),
      user: presentUser(user),
    };
  }
}
