import { IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min, MinLength, ArrayNotEmpty } from 'class-validator';

/** Contexto de uma viagem; o DNA continua pertencendo ao usuário. */
export class GenerationTripPreferenceDto {
  @IsNumber() @Min(0) budget_min!: number;
  @IsNumber() @Min(0.01) budget_max!: number;
  @IsString() @Length(3, 3) currency_code!: string;
  @IsIn(['solo', 'family', 'couple', 'friends']) companionship!: string;
  @IsInt() @Min(1) @Max(60) preferred_trip_length_days!: number;
  @IsString() @MinLength(1) travel_month!: string;
  @IsIn(['budget', 'mid', 'luxury']) hotel_level!: string;
  @IsIn(['public', 'mixed', 'private']) transportation_style!: string;
  @IsArray() @IsString({ each: true }) dietary_preferences!: string[];
  @IsArray() @IsString({ each: true }) accessibility_needs!: string[];
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) interests!: string[];
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
