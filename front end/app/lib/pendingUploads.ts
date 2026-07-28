type PendingUploadEntry = {
  file?: File;
  completed: boolean;
};

const pendingUploads = new Map<string, PendingUploadEntry>();

function createClientUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function registerPendingUpload(file: File) {
  const clientUploadId = createClientUploadId();
  pendingUploads.set(clientUploadId, { file, completed: false });
  return clientUploadId;
}

export function getPendingUpload(clientUploadId?: string) {
  if (!clientUploadId) return undefined;
  return pendingUploads.get(clientUploadId)?.file;
}

export function isPendingUploadComplete(clientUploadId?: string) {
  if (!clientUploadId) return false;
  return pendingUploads.get(clientUploadId)?.completed === true;
}

export function markPendingUploadComplete(clientUploadId?: string) {
  if (!clientUploadId) return;
  const entry = pendingUploads.get(clientUploadId);
  if (!entry) return;
  pendingUploads.set(clientUploadId, { completed: true });
}

export function releasePendingUpload(clientUploadId?: string) {
  if (!clientUploadId) return;
  pendingUploads.delete(clientUploadId);
}
