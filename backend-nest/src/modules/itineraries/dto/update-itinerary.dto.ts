import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateItineraryDto {
  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ValidateIf(isDefined)
  @IsString()
  summary?: string;

  // Datas aceitam null para limpar o campo.
  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(60)
  duration_days?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_total?: number;

  @ValidateIf(isDefined)
  @IsString()
  @Length(3, 3)
  currency_code?: string;
}
