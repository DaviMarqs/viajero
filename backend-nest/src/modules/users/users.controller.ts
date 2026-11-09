import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { presentUser } from './user.presenter';
import { UpdateUserDto } from './dto/update-user.dto';
import { ReplaceUserDto } from './dto/replace-user.dto';
import { avatarUploadOptions, UploadedAvatarFile } from './avatar-upload';

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
    const user = await this.users.updateProfile(authUser, authUser.id, dto);
    return this.response.withMessage('Usuario atualizado com sucesso.').build(presentUser(user));
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @CurrentUser() authUser: AuthenticatedUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('Selecione uma imagem.');
    const user = await this.users.setAvatar(authUser.id, file, `${request.protocol}://${request.get('host')}`);
    return this.response.withMessage('Avatar atualizado com sucesso.').build(presentUser(user));
  }

  // Rotas por id depois das de `me`: o proprio usuario ou staff (o Django deixava aberto com AllowAny).
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async retrieve(@CurrentUser() authUser: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const user = await this.users.findManageable(authUser, id);
    return this.response.withMessage('Registro carregado com sucesso.').build(presentUser(user));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async replace(@CurrentUser() authUser: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReplaceUserDto) {
    const user = await this.users.updateProfile(authUser, id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(presentUser(user));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() authUser: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    const user = await this.users.updateProfile(authUser, id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(presentUser(user));
  }
}
