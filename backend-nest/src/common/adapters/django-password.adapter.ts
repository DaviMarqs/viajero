import { Injectable } from '@nestjs/common';
import { pbkdf2Sync, randomBytes } from 'crypto';

@Injectable()
export class DjangoPasswordAdapter {
  encode(password: string): string {
    const iterations = 870000;
    const salt = randomBytes(12).toString('base64url');
    const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
    return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
  }

  verify(password: string, encoded: string): boolean {
    const [algorithm, iterationsText, salt, expected] = encoded.split('$');
    if (algorithm !== 'pbkdf2_sha256' || !iterationsText || !salt || !expected) {
      return false;
    }
    const iterations = Number(iterationsText);
    const actual = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
    return actual === expected;
  }
}
