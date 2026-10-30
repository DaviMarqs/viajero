import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { GenerationTripPreferenceDto } from '../../itineraries/dto/generation-trip-preference.dto';

export class SuggestDestinationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationTripPreferenceDto)
  trip_preferences?: GenerationTripPreferenceDto;
}
