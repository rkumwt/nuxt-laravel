import { randomInt } from 'node:crypto';

const ALPHANUMERIC =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Cryptographically secure equivalent of Laravel's Str::random()
export const randomString = (length: number) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC[randomInt(ALPHANUMERIC.length)];
  }
  return result;
};
