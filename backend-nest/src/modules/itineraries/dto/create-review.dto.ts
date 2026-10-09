import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToId } from '../../../common/validation';

export class CreateReviewDto {
  @ToId()
  @IsInt()
  itinerary!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
