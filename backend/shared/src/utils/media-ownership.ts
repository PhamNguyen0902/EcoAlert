import { createHmac, timingSafeEqual } from 'crypto';

const mediaSecret = () => process.env.SERVICE_AUTH_SECRET || process.env.JWT_SECRET || '';

export function signMediaOwnership(ownerId: string, url: string): string {
  const secret = mediaSecret();
  if (secret.length < 16) throw new Error('Media ownership signing is not configured');
  return `v1:${createHmac('sha256', secret).update(JSON.stringify([ownerId, url])).digest('hex')}`;
}

export function verifyMediaOwnership(ownerId: string, url: string, proof: string): boolean {
  if (!/^v1:[a-f0-9]{64}$/.test(proof)) return false;
  try {
    const expected = Buffer.from(signMediaOwnership(ownerId, url));
    const received = Buffer.from(proof);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch { return false; }
}
