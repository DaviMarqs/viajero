import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DjangoDefaultsSubscriber } from './django-defaults.subscriber';

export function databaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:1414@localhost:5432/viajero',
    autoLoadEntities: true,
    synchronize: false,
    // bigint (ids do Django) como number, igual ao DRF.
    parseInt8: true,
    subscribers: [DjangoDefaultsSubscriber],
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
