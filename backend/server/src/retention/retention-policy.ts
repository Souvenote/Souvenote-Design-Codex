export const RETENTION_POLICY = {
  version: '2026-07-25',
  status: 'staging_baseline_pending_legal_review',
  jurisdiction: 'British Columbia, Canada',
  principles: [
    'Retain personal information only while it serves an identified purpose or a legal or documented business requirement.',
    'Use the shortest applicable period when more than one category could apply.',
    'Suspend deletion only for a documented legal hold, dispute, fraud investigation, or access request.',
    'Delete or irreversibly anonymize data when its retention period ends.',
  ],
  schedule: [
    {
      id: 'uncommitted_uploads',
      data: 'Upload requests and private objects that were never committed to a card draft.',
      trigger: 'upload_requested',
      action: 'delete',
      durationDays: 1,
    },
    {
      id: 'failed_or_rejected_creative_assets',
      data: 'Failed generation outputs, rejected uploads, and provider troubleshooting payloads.',
      trigger: 'terminal_failure_or_rejection',
      action: 'delete_or_anonymize',
      durationDays: 30,
    },
    {
      id: 'abandoned_drafts',
      data: 'Drafts and associated creative assets that were never approved or ordered.',
      trigger: 'last_draft_activity',
      action: 'delete',
      durationDays: 90,
    },
    {
      id: 'saved_cards_and_songs',
      data: 'Approved cards, messages, songs, and active public keepsake links.',
      trigger: 'owner_deletion_or_account_deletion',
      action: 'delete_and_revoke_links',
      durationDays: 30,
      notes:
        'Retained while the account remains active. The 30-day period is an account-deletion recovery grace period.',
    },
    {
      id: 'delivery_addresses',
      data: 'Recipient and sender postal addresses attached to completed, cancelled, or refunded orders.',
      trigger: 'order_terminal_state',
      action: 'redact',
      durationDays: 180,
    },
    {
      id: 'notification_delivery_metadata',
      data: 'Transactional delivery attempts, provider message identifiers, and delivery events.',
      trigger: 'notification_terminal_state',
      action: 'delete_or_anonymize',
      durationDays: 90,
    },
    {
      id: 'privacy_and_account_decisions',
      data: 'Information used to make a decision that directly affects an individual, including privacy-request decisions.',
      trigger: 'decision_date',
      action: 'delete_or_anonymize',
      minimumDurationDays: 365,
    },
    {
      id: 'financial_and_order_records',
      data: 'Invoices, payment, refund, pricing, tax, order, and fulfillment records required for accounting or dispute evidence.',
      trigger: 'end_of_last_tax_year_related_to_record',
      action: 'delete_or_anonymize_nonfinancial_fields',
      durationYears: 6,
    },
    {
      id: 'backup_deletion_propagation',
      data: 'Deleted primary records remaining in encrypted backups or noncurrent object versions.',
      trigger: 'primary_deletion',
      action: 'expire',
      maximumDurationDays: 35,
    },
    {
      id: 'staging_synthetic_accounts',
      data: 'Synthetic staging users and their associated test data.',
      trigger: 'test_completion',
      action: 'delete',
      durationDays: 30,
    },
  ],
  exceptions: {
    legalHold:
      'A documented legal hold, dispute, fraud investigation, security incident, or active access request pauses deletion only for the affected records.',
    deletionVerification:
      'Retention jobs must record category-level counts and errors without copying the deleted personal content into logs.',
  },
} as const;
