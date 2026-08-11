'use client';

import * as React from 'react';
import { mockUpload, refreshCardDraftBackendState, updateCardDraft } from './api';
import { getPendingUpload } from './pendingUploads';
import {
  getReferenceImageUploads,
  markReferenceImagesUploaded,
  persistableCreativeBrief,
  referenceUploadSignature,
} from './referenceUploads';

export type ReferenceUploadDraftInput = {
  occasion?: string;
  relationship?: string;
  creativeBrief: Record<string, unknown>;
};

export function useReferenceUploads(onUploaded?: (draftInput: ReferenceUploadDraftInput) => void): {
  uploading: boolean;
  upload: (cardDraftId: string, draftInput: ReferenceUploadDraftInput) => Promise<void>;
  reset: () => void;
} {
  const [uploading, setUploading] = React.useState(false);
  const uploadedSignatureRef = React.useRef('');
  const onUploadedRef = React.useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const upload = React.useCallback(async (cardDraftId: string, draftInput: ReferenceUploadDraftInput) => {
    const uploads = getReferenceImageUploads(draftInput.creativeBrief);
    if (!uploads.length) return;

    const signature = referenceUploadSignature(cardDraftId, uploads);
    const uploadedDraftInput = {
      ...draftInput,
      creativeBrief: markReferenceImagesUploaded(draftInput.creativeBrief),
    };
    if (uploadedSignatureRef.current === signature) {
      await updateCardDraft(cardDraftId, {
        occasion: draftInput.occasion,
        relationship: draftInput.relationship,
        creativeBrief: persistableCreativeBrief(uploadedDraftInput.creativeBrief),
      });
      onUploadedRef.current?.(uploadedDraftInput);
      return;
    }

    setUploading(true);
    try {
      const files = uploads.map((pendingUpload) => getPendingUpload(pendingUpload.clientKey));
      if (files.some((file) => !file)) {
        throw new Error('Select your reference photos again so their private upload can be completed.');
      }
      await Promise.all(files.map((file) => mockUpload({ cardDraftId, file: file! })));
      await updateCardDraft(cardDraftId, {
        occasion: draftInput.occasion,
        relationship: draftInput.relationship,
        creativeBrief: persistableCreativeBrief(uploadedDraftInput.creativeBrief),
      });
      uploadedSignatureRef.current = signature;
      onUploadedRef.current?.(uploadedDraftInput);
      await refreshCardDraftBackendState(cardDraftId);
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    uploadedSignatureRef.current = '';
  }, []);

  return { uploading, upload, reset };
}
