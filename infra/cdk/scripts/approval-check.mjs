import { readFile } from 'node:fs/promises';
import path from 'node:path';

const approvalPath = path.resolve(import.meta.dirname, '../../../docs/operations/section-6-aws-staging-approval.md');
const packet = await readFile(approvalPath, 'utf8');
for (const field of [
  'Approval ID:',
  'Account and region:',
  'Infrastructure/configuration diff:',
  'One-time gross cost estimate:',
  'Monthly gross cost estimate:',
  'Worst-case cost before billing refresh:',
  'AWS credit eligibility:',
  'Possible cash exposure:',
  'Rollback/shutdown procedure:',
  'Data-loss risk:',
  'Approval expiry:',
]) {
  if (!packet.includes(field)) throw new Error(`Section 6 approval packet is missing ${field}`);
}
if (!packet.includes('APPROVE AWS-STAGING-006 UP TO USD 125 GROSS THROUGH 2026-08-31')) {
  throw new Error('Section 6 approval packet is missing its exact bounded approval phrase.');
}
console.log('Section 6 AWS staging approval packet is structurally complete.');
