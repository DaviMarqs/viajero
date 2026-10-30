import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ILike, Repository } from 'typeorm';
import { User } from './user.entity';
import { DjangoPasswordAdapter } from '../../common/adapters/django-password.adapter';
import { UpdateUserDto } from './dto/update-user.dto';
import { AVATAR_EXTENSIONS, UploadedAvatarFile } from './avatar-upload';
import { UPLOADS_ROOT, UPLOADS_URL_PREFIX } from '../../common/uploads';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: DjangoPasswordAdapter,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: ILike(email.trim().toLowerCase()) } });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async create(input: { email: string; password: string; username?: string; display_name?: string; first_name?: string; last_name?: string }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const username = input.username?.trim() || (await this.generateUsername(email));
    const firstName = input.first_name ?? '';
    const lastName = input.last_name ?? '';
    const displayName = input.display_name || [firstName, lastName].filter(Boolean).join(' ').trim() || username;
    const user = this.users.create({
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      password: this.passwords.encode(input.password),
      is_active: true,
      is_staff: false,
      is_superuser: false,
      preferred_currency: 'BRL',
    });
    return this.users.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario nao encontrado.');
    Object.assign(user, dto);
    if (dto.email) user.email = dto.email.trim().toLowerCase();
    return this.users.save(user);
  }

  async setAvatar(id: number, file: UploadedAvatarFile, baseUrl: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario nao encontrado.');
    const directory = join(UPLOADS_ROOT, 'avatars');
    const filename = `${id}-${Date.now()}.${AVATAR_EXTENSIONS[file.mimetype]}`;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);
    user.avatar_url = `${baseUrl}${UPLOADS_URL_PREFIX}/avatars/${filename}`;
    return this.users.save(user);
  }

  private async generateUsername(email: string): Promise<string> {
    const base = email.split('@')[0].slice(0, 150) || 'viajero';
    let candidate = base;
    let suffix = 1;
    while (await this.users.exists({ where: { username: ILike(candidate) } })) {
      suffix += 1;
      candidate = `${base.slice(0, Math.max(1, 150 - String(suffix).length - 1))}-${suffix}`;
    }
    return candidate;
  }
}
