import { join } from 'path';

/** Pasta servida em /uploads (fora do git). */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const UPLOADS_URL_PREFIX = '/uploads';
