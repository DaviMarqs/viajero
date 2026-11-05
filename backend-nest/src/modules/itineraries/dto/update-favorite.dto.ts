import { IsInt, ValidateIf } from 'class-validator';
import { isDefined, ToId } from '../../../common/validation';

/** PATCH /api/favorites/:id (o PUT usa o CreateFavoriteDto, com `itinerary` obrigatorio). */
export class UpdateFavoriteDto {
  @ValidateIf(isDefined)
  @ToId()
  @IsInt()
  itinerary?: number;
}
