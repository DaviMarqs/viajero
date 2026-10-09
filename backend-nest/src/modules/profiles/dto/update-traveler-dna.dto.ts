import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateTravelerDnaDto {
  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(80)
  travel_style?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  pace?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  comfort_level?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  social_energy?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  adventure_level?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  food_focus?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  cultural_interest?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  nature_interest?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  nightlife_interest?: number;

  @ValidateIf(isDefined)
  @IsString()
  notes?: string;
}
