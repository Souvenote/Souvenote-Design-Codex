# Souvenote Data Retention Policy

**Policy version:** 2026-07-25
**Status:** Staging baseline pending legal review
**Primary jurisdiction assumed:** British Columbia, Canada

## Purpose

This policy defines the maximum or minimum period for each data category.
The backend endpoint `GET /api/retention-policy` is the machine-readable
canonical schedule. Customer-facing privacy copy must not promise a different
period.

This is an operational staging baseline, not legal advice. Canadian/BC privacy
and tax counsel must review it before production.

## Governing principles

1. Keep personal information only while it serves an identified purpose or a
   legal or documented business requirement.
2. Apply the shortest relevant period when more than one category could apply.
3. Delete or irreversibly anonymize expired information.
4. Pause deletion only for a documented legal hold, dispute, fraud
   investigation, security incident, or active access request, and only for
   affected records.
5. Record retention-job category counts and errors without copying deleted
   personal content into logs.

The baseline reflects:

- BC PIPA section 35: retain information used to make a decision directly
  affecting an individual for at least one year, then destroy or de-identify it
  when its purpose and legal/business need end:
  https://www.bclaws.gov.bc.ca/civix/document/id/consol17/consol17/00_03063_01
- Office of the Privacy Commissioner guidance to establish minimum and maximum
  periods and securely dispose of information that no longer serves its
  purpose:
  https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_use/
- CRA guidance to keep business and tax records for six years from the end of
  the last tax year to which they relate:
  https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc188/keeping-records.html

## Schedule

| Category | Trigger | Period | End-of-period action |
| --- | --- | ---: | --- |
| Uncommitted upload requests and objects | Upload requested | 1 day | Delete |
| Failed/rejected creative assets and provider troubleshooting payloads | Terminal failure/rejection | 30 days | Delete or anonymize |
| Drafts never approved or ordered, with associated assets | Last draft activity | 90 days | Delete |
| Approved saved cards, messages, songs, and active keepsake links | Owner/account deletion | Active-account lifetime plus 30-day recovery grace | Delete assets and revoke links |
| Recipient and sender postal addresses | Order reaches a terminal state | 180 days | Redact from operational records |
| Notification delivery metadata | Notification reaches a terminal state | 90 days | Delete or anonymize |
| Privacy/account decision evidence | Decision date | Minimum 365 days | Delete or anonymize after all recourse ends |
| Financial, tax, payment, refund, order, and fulfillment evidence | End of last related tax year | 6 years | Delete or anonymize nonfinancial fields |
| Deleted primary data remaining in encrypted backups/noncurrent object versions | Primary deletion | Maximum 35 days | Expire |
| Synthetic staging users and test data | Test completion | 30 days | Delete |

## Account deletion

An account-deletion request starts a 30-day recovery grace period. During the
grace period, ordinary processing stops except for recovery, security, legal,
and required recordkeeping. At the end:

- revoke public keepsake links associated only with deleted content;
- delete creative assets, drafts, profile data, and authentication linkage;
- redact delivery addresses when no active exception applies;
- retain only the minimized financial, tax, dispute, privacy-decision, and
  security evidence required by the schedule;
- let deletion propagate through backups and noncurrent object versions within
  35 days.

## Enforcement status

Implemented:

- versioned canonical schedule in backend source;
- public read-only policy endpoint;
- owner-scoped API queries and foreign-record denial;
- soft-deleted draft filtering;
- S3 noncurrent-version expiration and incomplete multipart cleanup;
- short CloudWatch log retention in staging.

Required before production:

- scheduled, idempotent purge/redaction jobs with database advisory locking;
- S3 object deletion tied to the database retention decisions;
- legal-hold registry and release workflow;
- account deletion/recovery workflow;
- customer export/deletion request workflow;
- metrics, alerts, dry-run reports, and sampled deletion verification;
- backup deletion-propagation test;
- legal/privacy approval and an identified privacy officer.

Automatic destructive retention jobs must remain disabled until the dry-run
output and legal review are approved.
