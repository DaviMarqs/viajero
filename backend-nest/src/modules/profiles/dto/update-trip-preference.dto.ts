import { IsArray, IsInt, IsNumber, IsObject, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateTripPreferenceDto {
  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_max?: number;

  @ValidateIf(isDefined)
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  companionship?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(60)
  preferred_trip_length_days?: number;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(20)
  travel_month?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  hotel_level?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  transportation_style?: string;

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  dietary_preferences?: string[];

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  accessibility_needs?: string[];

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}
