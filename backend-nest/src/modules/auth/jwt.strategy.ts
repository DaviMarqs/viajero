import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AuthenticatedUser {
  id: number;
  email: string;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET_KEY', 'unsafe-dev-secret'),
    });
  }

  validate(payload: { sub: number; email: string; username: string; is_staff?: boolean; is_superuser?: boolean }): AuthenticatedUser {
    return {
      id: Number(payload.sub),
      email: payload.email,
      username: payload.username,
      is_staff: Boolean(payload.is_staff),
      is_superuser: Boolean(payload.is_superuser),
    };
  }
}
