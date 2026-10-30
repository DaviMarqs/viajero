import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateReviewDto {
  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(120)
  title?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(2000)
  body?: string;
}
