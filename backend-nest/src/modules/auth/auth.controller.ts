import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './jwt.strategy';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly response: ApiResponseBuilder) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.response.withMessage('Usuario cadastrado com sucesso.').build(await this.auth.register(dto));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.response.withMessage('Autenticacao realizada com sucesso.').build(await this.auth.login(dto));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.id);
    return this.response.withMessage('Sessao encerrada com sucesso.').build(null);
  }
}
