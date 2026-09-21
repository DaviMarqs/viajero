import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  username?: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  home_airport?: string;

  @IsOptional()
  @IsString()
  preferred_currency?: string;

  @IsOptional()
  @IsBoolean()
  is_profile_complete?: boolean;
}
