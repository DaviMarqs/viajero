import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function databaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:1414@localhost:5432/viajero',
    autoLoadEntities: true,
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
