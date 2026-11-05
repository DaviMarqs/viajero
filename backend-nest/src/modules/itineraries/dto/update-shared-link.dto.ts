import { IsBoolean, IsDateString, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { isDefined, ToId } from '../../../common/validation';

/** PUT /api/shared-links/:id: `itinerary` obrigatorio como no serializer do Django; token nao muda. */
export class ReplaceSharedLinkDto {
  @ToId()
  @IsInt()
  itinerary!: number;

  // null remove a expiracao.
  @IsOptional()
  @IsDateString()
  expires_at?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** PATCH /api/shared-links/:id. */
export class UpdateSharedLinkDto {
  @ValidateIf(isDefined)
  @ToId()
  @IsInt()
  itinerary?: number;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;

  @ValidateIf(isDefined)
  @IsBoolean()
  is_active?: boolean;
}
