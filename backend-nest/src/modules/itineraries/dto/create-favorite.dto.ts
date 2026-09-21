import { IsInt } from 'class-validator';

export class CreateFavoriteDto {
  @IsInt()
  itinerary!: number;
}
