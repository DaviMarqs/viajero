import { DjangoPasswordAdapter } from '../django-password.adapter';

describe('DjangoPasswordAdapter', () => {
  it('encodes and verifies Django pbkdf2_sha256 passwords', () => {
    const adapter = new DjangoPasswordAdapter();
    const encoded = adapter.encode('password123');

    expect(encoded.startsWith('pbkdf2_sha256$')).toBe(true);
    expect(adapter.verify('password123', encoded)).toBe(true);
    expect(adapter.verify('wrong-password', encoded)).toBe(false);
  });
});
