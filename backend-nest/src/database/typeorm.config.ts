import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DjangoDefaultsSubscriber } from './django-defaults.subscriber';

export function databaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:1414@localhost:5432/viajero',
    autoLoadEntities: true,
    synchronize: false,
    // Sem parseInt8: o TypeORM devolve ids bigint gerados como string (bugfix #720) e compara
    // relacoes por id ao salvar; misturar number e string faz ele "desvincular" filhos.
    // Os DTOs convertem ids recebidos como string (common/validation.ts).
    subscribers: [DjangoDefaultsSubscriber],
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
