import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TravelerDnaDto {
  @IsString()
  travel_style!: string;

  @IsString()
  pace!: string;

  @IsString()
  comfort_level!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  social_energy!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  adventure_level!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  food_focus!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  cultural_interest!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  nature_interest!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  nightlife_interest!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
