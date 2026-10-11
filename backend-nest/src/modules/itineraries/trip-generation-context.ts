import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GenerationTripPreferenceDto } from './dto/generation-trip-preference.dto';

export function requireTripParameters(value: unknown): GenerationTripPreferenceDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Configure os parâmetros desta viagem antes de gerar o roteiro.');
  }
  const dto = plainToInstance(GenerationTripPreferenceDto, value);
  if (validateSync(dto).length || dto.budget_min > dto.budget_max) {
    throw new BadRequestException('Revise orçamento, companhia, duração, período, hospedagem, transporte e interesses desta viagem.');
  }
  return dto;
}
