export type ReferenceImageUpload = {
  filename: string;
  mimeType: string;
  size: number;
  clientKey?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function photoRecord(creativeBrief: Record<string, unknown>): Record<string, unknown> {
  return asRecord(creativeBrief.photo);
}

export function getReferenceImageUploads(creativeBrief: Record<string, unknown>): ReferenceImageUpload[] {
  const referenceImages = photoRecord(creativeBrief).referenceImages;
  if (!Array.isArray(referenceImages)) return [];

  return referenceImages.flatMap((item) => {
    const record = asRecord(item);
    const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : '';
    const size = typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : 0;
    const clientKey = typeof record.clientKey === 'string' ? record.clientKey.trim() || undefined : undefined;

    if (record.uploaded === true || !filename || !mimeType.includes('/') || size <= 0) return [];
    return [{ filename, mimeType, size, clientKey }];
  });
}

export function referenceUploadSignature(cardDraftId: string, uploads: ReferenceImageUpload[]): string {
  return `${cardDraftId}:${JSON.stringify(uploads)}`;
}

export function persistableCreativeBrief(creativeBrief: Record<string, unknown>): Record<string, unknown> {
  const photo = photoRecord(creativeBrief);
  if (!Array.isArray(photo.referenceImages)) return creativeBrief;
  return {
    ...creativeBrief,
    photo: {
      ...photo,
      referenceImages: photo.referenceImages.map((item) => {
        const sanitized = { ...asRecord(item) };
        delete sanitized.clientKey;
        return sanitized;
      }),
    },
  };
}

export function markReferenceImagesUploaded(creativeBrief: Record<string, unknown>): Record<string, unknown> {
  const photo = photoRecord(creativeBrief);
  if (!Array.isArray(photo.referenceImages)) return creativeBrief;
  return {
    ...creativeBrief,
    photo: {
      ...photo,
      referenceImages: photo.referenceImages.map((item) => ({ ...asRecord(item), uploaded: true })),
    },
  };
}

export function preserveUploadedReferenceMarkers(
  creativeBrief: Record<string, unknown>,
  uploadedCreativeBrief: Record<string, unknown>,
): Record<string, unknown> {
  const photo = photoRecord(creativeBrief);
  const uploadedReferences = photoRecord(uploadedCreativeBrief).referenceImages;
  if (!Array.isArray(photo.referenceImages) || !Array.isArray(uploadedReferences)) return creativeBrief;

  const uploadedKeys = new Set(
    uploadedReferences.filter((item) => asRecord(item).uploaded === true).map((item) => referenceKey(asRecord(item))),
  );
  return {
    ...creativeBrief,
    photo: {
      ...photo,
      referenceImages: photo.referenceImages.map((item) => {
        const reference = asRecord(item);
        if (reference.clientKey || !uploadedKeys.has(referenceKey(reference))) return reference;
        return { ...reference, uploaded: true };
      }),
    },
  };
}

function referenceKey(reference: Record<string, unknown>): string {
  return JSON.stringify([reference.filename, reference.mimeType, reference.size]);
}
