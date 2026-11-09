import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** PUT /api/users/:id: como o UserSerializer do Django, email e username sao obrigatorios; o resto e opcional. */
export class ReplaceUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 150)
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  home_airport?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  preferred_currency?: string;

  @IsOptional()
  @IsBoolean()
  is_profile_complete?: boolean;
}
