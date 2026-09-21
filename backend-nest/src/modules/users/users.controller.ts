import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { presentUser } from './user.presenter';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService, private readonly response: ApiResponseBuilder) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() authUser: AuthenticatedUser) {
    const user = await this.users.findById(authUser.id);
    return this.response.withMessage('Usuario carregado com sucesso.').build(user ? presentUser(user) : null);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() authUser: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.response.withMessage('Usuario atualizado com sucesso.').build(presentUser(await this.users.update(authUser.id, dto)));
  }
}
