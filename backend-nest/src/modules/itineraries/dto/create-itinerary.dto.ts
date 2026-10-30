import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerationTripPreferenceDto } from './generation-trip-preference.dto';
import { ToId } from '../../../common/validation';

export class CreateItineraryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationTripPreferenceDto)
  trip_preferences?: GenerationTripPreferenceDto;

  @ToId()
  @IsInt()
  destination!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  duration_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_total?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;
}
