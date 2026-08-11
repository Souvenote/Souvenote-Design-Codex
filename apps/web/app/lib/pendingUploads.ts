'use client';

const pendingUploads = new Map<string, File>();

export function registerPendingUpload(file: File): string {
  const key = crypto.randomUUID();
  pendingUploads.set(key, file);
  return key;
}

export function getPendingUpload(key: string | undefined): File | null {
  return key ? (pendingUploads.get(key) ?? null) : null;
}

export function releasePendingUpload(key: string | undefined): void {
  if (key) pendingUploads.delete(key);
}
