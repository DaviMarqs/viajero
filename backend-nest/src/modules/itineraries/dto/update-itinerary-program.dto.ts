import { ArrayMaxSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toIds = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => (typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item) : item)) : value;

export class ProgramLayoutDayDto {
  @IsInt()
  @Min(1)
  day_number!: number;

  // Ids bigint saem da API como string; aceita "12" ou 12.
  @Transform(({ value }) => toIds(value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  event_ids!: number[];
}

export class UpdateItineraryProgramDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ProgramLayoutDayDto)
  days!: ProgramLayoutDayDto[];
}
