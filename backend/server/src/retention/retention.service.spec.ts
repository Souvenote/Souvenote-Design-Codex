import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  const service = new RetentionService();

  it('publishes the versioned staging baseline', () => {
    expect(service.getPolicy()).toMatchObject({
      version: '2026-07-25',
      status: 'staging_baseline_pending_legal_review',
      jurisdiction: 'British Columbia, Canada',
    });
  });

  it('defines short-lived creative data and required record windows', () => {
    const schedule = service.getPolicy().schedule;
    const byId = new Map(schedule.map((entry) => [entry.id, entry]));

    expect(byId.get('uncommitted_uploads')).toMatchObject({
      action: 'delete',
      durationDays: 1,
    });
    expect(byId.get('abandoned_drafts')).toMatchObject({
      action: 'delete',
      durationDays: 90,
    });
    expect(byId.get('delivery_addresses')).toMatchObject({
      action: 'redact',
      durationDays: 180,
    });
    expect(byId.get('privacy_and_account_decisions')).toMatchObject({
      minimumDurationDays: 365,
    });
    expect(byId.get('financial_and_order_records')).toMatchObject({
      durationYears: 6,
    });
    expect(byId.get('backup_deletion_propagation')).toMatchObject({
      maximumDurationDays: 35,
    });
  });

  it('documents legal-hold and deletion-verification exceptions', () => {
    expect(service.getPolicy().exceptions.legalHold).toContain(
      'pauses deletion',
    );
    expect(service.getPolicy().exceptions.deletionVerification).toContain(
      'without copying the deleted personal content',
    );
  });
});
