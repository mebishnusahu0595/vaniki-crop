import crypto from 'crypto';
import { AppError } from './AppError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function resolveEncryptionKey(): Buffer {
  const configured = process.env.STORE_SECRET_ENCRYPTION_KEY;
  if (configured) {
    if (/^[0-9a-fA-F]{64}$/.test(configured)) {
      return Buffer.from(configured, 'hex');
    }

    try {
      const base64Decoded = Buffer.from(configured, 'base64');
      if (base64Decoded.length === 32) {
        return base64Decoded;
      }
    } catch {
      // Fall through to hash-based derivation.
    }

    return crypto.createHash('sha256').update(configured).digest();
  }

  const fallbackSeed = process.env.JWT_SECRET || 'vaniki-dev-store-secret-seed';
  return crypto.createHash('sha256').update(fallbackSeed).digest();
}

function getEncryptionKey(): Buffer {
  const key = resolveEncryptionKey();
  if (key.length !== 32) {
    throw new AppError('Store secret encryption key must resolve to 32 bytes', 500);
  }
  return key;
}

export function encryptStoreSecret(value: string): string {
  if (!value) {
    throw new AppError('Secret value cannot be empty', 400);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptStoreSecret(payload: string): string {
  const [ivEncoded, authTagEncoded, encryptedEncoded] = payload.split(':');

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new AppError('Malformed encrypted secret payload', 500);
  }

  try {
    const iv = Buffer.from(ivEncoded, 'base64');
    const authTag = Buffer.from(authTagEncoded, 'base64');
    const encrypted = Buffer.from(encryptedEncoded, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new AppError('Unable to decrypt store secret', 500);
  }
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '*'.repeat(value.length);

  const start = value.slice(0, 2);
  const end = value.slice(-2);
  const middle = '*'.repeat(Math.max(4, value.length - 4));
  return `${start}${middle}${end}`;
}

export function maskEncryptedSecret(payload: string): string {
  return maskSecret(decryptStoreSecret(payload));
}
