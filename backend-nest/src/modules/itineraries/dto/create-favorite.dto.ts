import { IsInt } from 'class-validator';
import { ToId } from '../../../common/validation';

export class CreateFavoriteDto {
  @ToId()
  @IsInt()
  itinerary!: number;
}
