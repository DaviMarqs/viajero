import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateItineraryDto {
  @IsInt()
  destination!: number;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsInt()
  @Min(1)
  @Max(60)
  duration_days!: number;

  @IsOptional()
  @IsNumber()
  budget_total?: number;

  @IsOptional()
  @IsString()
  currency_code?: string;
}
