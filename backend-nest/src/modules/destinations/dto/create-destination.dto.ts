import { IsOptional, IsString } from 'class-validator';

export class CreateDestinationDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  hero_image_url?: string;
}
