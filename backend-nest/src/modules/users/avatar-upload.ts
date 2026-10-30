import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// SVG fica de fora: pode carregar script e seria servido pela mesma origem da API.
export const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Arquivo em memoria entregue pelo FileInterceptor (sem storage configurado). */
export interface UploadedAvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const avatarUploadOptions: MulterOptions = {
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (AVATAR_EXTENSIONS[file.mimetype]) {
      callback(null, true);
      return;
    }
    callback(new BadRequestException('Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.'), false);
  },
};
