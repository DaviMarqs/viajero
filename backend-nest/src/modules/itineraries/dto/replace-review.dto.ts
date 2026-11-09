import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToId } from '../../../common/validation';

/** PUT /api/reviews/:id: nota obrigatoria; `itinerary`, se enviado, precisa ser o mesmo da avaliacao. */
export class ReplaceReviewDto {
  @IsOptional()
  @ToId()
  @IsInt()
  itinerary?: number;

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
