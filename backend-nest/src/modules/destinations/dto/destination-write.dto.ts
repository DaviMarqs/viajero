import { IsNumber, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

/** SlugField do Django. */
export const SLUG_PATTERN = /^[-a-zA-Z0-9_]+$/;
const SLUG_MESSAGE = 'O slug aceita apenas letras, numeros, hifen e sublinhado.';

/** PUT /api/destinations/:id: obrigatorios como no DestinationSerializer (slug, name, country). */
export class ReplaceDestinationDto {
  @IsString()
  @Length(1, 50)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hero_image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  best_season?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  average_rating?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** PATCH /api/destinations/:id: so valida o que foi enviado. */
export class UpdateDestinationDto {
  @ValidateIf(isDefined)
  @IsString()
  @Length(1, 50)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ValidateIf(isDefined)
  @IsString()
  @Length(1, 150)
  name?: string;

  @ValidateIf(isDefined)
  @IsString()
  @Length(1, 100)
  country?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ValidateIf(isDefined)
  @IsString()
  summary?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(500)
  hero_image_url?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(120)
  best_season?: string;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  @Max(5)
  average_rating?: number;

  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}
