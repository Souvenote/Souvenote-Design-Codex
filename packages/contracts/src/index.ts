/**
 * Stable cross-process primitives. Section 2 replaces handwritten API DTOs
 * with generated OpenAPI contracts while preserving these public states.
 */
export type ApiError = {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};

export type AssetGenerationStatus = 'pending' | 'generating' | 'ready' | 'failed';

export type GenerationJobStatus =
  'queued' | 'running' | 'succeeded' | 'partially_failed' | 'failed' | 'refunded' | 'canceled' | 'approved';

export type UploadStatus =
  | 'upload_pending'
  | 'upload_done'
  | 'moderation_pending'
  | 'moderation_passed'
  | 'moderation_failed'
  | 'attestation_required'
  | 'attestation_done'
  | 'committed';

export type { paths, components, operations } from './generated/openapi.js';
export { createSouvenoteApiClient } from './client.js';
