import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Detalhes ricos gerados pela IA (tipo do evento, dicas, plano B, alternativas) em jsonb.
 * Com DEFAULT '{}', as linhas existentes ficam validas e o Django legado continua inserindo sem a coluna.
 */
export const ITINERARY_DETAILS_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'itineraries_itineraryday', column: 'details' },
  { table: 'itineraries_itinerarydailyevent', column: 'details' },
];

export class ItineraryDetails1795564800000 implements MigrationInterface {
  name = 'ItineraryDetails1795564800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of ITINERARY_DETAILS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} jsonb NOT NULL DEFAULT '{}'::jsonb`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of ITINERARY_DETAILS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`);
    }
  }
}
