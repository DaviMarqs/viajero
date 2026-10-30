import { BadRequestException } from '@nestjs/common';
import { AVATAR_MAX_BYTES, avatarUploadOptions } from '../avatar-upload';

function filter(mimetype: string) {
  const callback = jest.fn();
  avatarUploadOptions.fileFilter?.({}, { mimetype } as never, callback);
  return callback.mock.calls[0] as [Error | null, boolean];
}

describe('avatarUploadOptions', () => {
  it('aceita imagens raster', () => {
    for (const mimetype of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(filter(mimetype)).toEqual([null, true]);
    }
  });

  it('recusa svg e outros tipos com mensagem PT', () => {
    const [error, accepted] = filter('image/svg+xml');
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error?.message).toBe('Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.');
  });

  it('limita a um arquivo de ate 2 MB', () => {
    expect(avatarUploadOptions.limits).toEqual({ fileSize: AVATAR_MAX_BYTES, files: 1 });
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
