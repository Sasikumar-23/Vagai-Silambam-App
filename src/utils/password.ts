import * as Crypto from 'expo-crypto';

const PREFIX = 'sha256';
const SEPARATOR = '$';
const SALT_BYTES = 16;

// Google accounts are authenticated by Google, so these rows must never accept a typed password.
const NON_LOGIN_SECRETS = ['google_oauth_auth', ''];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(salt: string, password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${password}`);
}

export function isHashed(stored: string): boolean {
  return stored.startsWith(`${PREFIX}${SEPARATOR}`);
}

export function isPasswordLoginAllowed(stored: string): boolean {
  return !NON_LOGIN_SECRETS.includes(stored);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = toHex(Crypto.getRandomBytes(SALT_BYTES));
  const hash = await digest(salt, password);
  return [PREFIX, salt, hash].join(SEPARATOR);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isPasswordLoginAllowed(stored)) return false;

  if (!isHashed(stored)) {
    return stored === password;
  }

  const [, salt, hash] = stored.split(SEPARATOR);
  if (!salt || !hash) return false;
  return (await digest(salt, password)) === hash;
}
