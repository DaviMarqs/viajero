import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { ToId } from '../../../common/validation';

export class CreateSharedLinkDto {
  @ToId()
  @IsInt()
  itinerary!: number;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
