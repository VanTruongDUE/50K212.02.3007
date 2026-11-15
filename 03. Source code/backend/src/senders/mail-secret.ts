import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(config: ConfigService): Buffer {
  const value = config.get<string>('SMTP_ENCRYPTION_KEY');
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value))
    throw new ServiceUnavailableException(
      'Chưa cấu hình khóa SMTP trên máy chủ.',
    );
  return Buffer.from(value, 'hex');
}

export function encryptMailSecret(
  config: ConfigService,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(config), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString('hex'))
    .join(':');
}

export function decryptMailSecret(
  config: ConfigService,
  secret: string,
): string {
  const [iv, tag, data] = secret
    .split(':')
    .map((part) => Buffer.from(part, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key(config), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
