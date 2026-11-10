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
  validateTripMetadata(dto.metadata, dto.preferred_trip_length_days);
  return dto;
}

export function validateTripMetadata(metadata: Record<string, unknown> | undefined, days: number): void {
  if (!metadata) return;
  for (const key of ['arrival_time', 'departure_time']) {
    const value = metadata[key];
    if (value !== undefined && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) {
      throw new BadRequestException('Informe chegada e partida no formato HH:mm.');
    }
  }
  if (metadata.dinner_preference !== undefined && (typeof metadata.dinner_preference !== 'string' || !['all', 'none', 'mixed'].includes(metadata.dinner_preference))) {
    throw new BadRequestException('Escolha jantar em restaurante todos os dias, nenhum dia ou meio a meio.');
  }
  if (days === 1 && typeof metadata.arrival_time === 'string' && typeof metadata.departure_time === 'string' && metadata.departure_time <= metadata.arrival_time) {
    throw new BadRequestException('Em uma viagem de um dia, a partida deve ser após a chegada.');
  }
}
