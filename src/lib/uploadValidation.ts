import { hasMatchingSignature } from '@/lib/userAvatar';

export function imageExtension(bytes: Uint8Array, mimeType: string): 'jpg' | 'png' | 'webp' | null {
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') return null;
  if (!hasMatchingSignature(bytes, mimeType)) return null;
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
}

export function validMemoryFile(bytes: Buffer, mimeType: string): boolean {
  if (imageExtension(bytes, mimeType)) return true;
  if (mimeType === 'image/gif') return /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'));
  return mimeType === 'application/pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
}
