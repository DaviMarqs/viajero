import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  itinerary!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
