import { EntityMetadata } from 'typeorm';
import { createDataSource } from '../data-source';

/** Metadata das entidades (mesma lista da CLI) sem conectar no banco. */
export async function loadEntityMetadatas(): Promise<EntityMetadata[]> {
  const dataSource = createDataSource('postgresql://test:test@127.0.0.1:1/test');
  await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  return dataSource.entityMetadatas;
}
