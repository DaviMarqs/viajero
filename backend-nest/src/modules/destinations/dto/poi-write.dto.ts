import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined, ToId } from '../../../common/validation';
import { VALID_POI_TYPES } from '../discovery/destination-prompts';
import { SLUG_PATTERN } from './destination-write.dto';

const SLUG_MESSAGE = 'O slug aceita apenas letras, numeros, hifen e sublinhado.';
const POI_TYPE_MESSAGE = `poi_type deve ser um de: ${VALID_POI_TYPES.join(', ')}.`;

/** POST e PUT /api/pois: obrigatorios como no PointOfInterestSerializer (tags sao somente leitura). */
export class CreatePoiDto {
  @ToId()
  @IsInt()
  destination!: number;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Length(1, 50)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsIn(VALID_POI_TYPES, { message: POI_TYPE_MESSAGE })
  poi_type!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  opening_hours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source_url?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  price_level?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimated_visit_minutes?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** PATCH /api/pois/:id: so valida o que foi enviado. */
export class UpdatePoiDto {
  @ValidateIf(isDefined)
  @ToId()
  @IsInt()
  destination?: number;

  @ValidateIf(isDefined)
  @IsString()
  @Length(1, 160)
  name?: string;

  @ValidateIf(isDefined)
  @IsString()
  @Length(1, 50)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ValidateIf(isDefined)
  @IsIn(VALID_POI_TYPES, { message: POI_TYPE_MESSAGE })
  poi_type?: string;

  @ValidateIf(isDefined)
  @IsString()
  summary?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(255)
  opening_hours?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(200)
  source_url?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(5)
  price_level?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(0)
  estimated_visit_minutes?: number;

  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}
