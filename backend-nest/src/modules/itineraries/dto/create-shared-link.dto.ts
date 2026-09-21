import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CreateSharedLinkDto {
  @IsInt()
  itinerary!: number;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
