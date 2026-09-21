import { IsArray, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class TripPreferenceDto {
  @IsNumber()
  budget_min!: number;

  @IsNumber()
  budget_max!: number;

  @IsString()
  currency_code!: string;

  @IsOptional()
  @IsString()
  companionship?: string;

  @IsInt()
  @Min(1)
  @Max(60)
  preferred_trip_length_days!: number;

  @IsOptional()
  @IsString()
  travel_month?: string;

  @IsOptional()
  @IsString()
  hotel_level?: string;

  @IsOptional()
  @IsString()
  transportation_style?: string;

  @IsOptional()
  @IsArray()
  dietary_preferences?: string[];

  @IsOptional()
  @IsArray()
  accessibility_needs?: string[];

  @IsOptional()
  @IsArray()
  interests?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
