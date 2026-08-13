# Section 6 AWS staging approval packet

Prepared: 2026-08-13

Approval status: pending explicit scoped approval; this document records no standing authorization.

Approval ID: `AWS-STAGING-006`

Purpose: Deploy the current `origin/main` Section 4/5 application lineage to the existing Souvenote staging foundation, with all non-AWS providers disabled, and prove smoke, backup/restore, and rollback.

Account and region: AWS account `654047456665`, `ca-central-1` (Canada Central), environment `staging`.

Resources/services affected:

- Reuse, without recreating: `souvenote-staging-v2` VPC/subnets/security groups, public ALB, CloudFront distribution, RDS PostgreSQL 16 `db.t4g.micro`, ECR repositories, CodeBuild project, S3 deployment bucket, ECS cluster/service, target groups, log groups, alarms, and SNS topic.
- Create in `souvenote-staging-release`: two bounded Fargate task-definition revisions, task/execution IAM roles, one retained BFF session secret, one Cognito Essentials user pool/domain/resource server/client, one 128 MB pre-token Lambda with seven-day logs, and one priority-5 ALB listener rule that sends `/api/auth/*`, `/api/bff/*`, and the exact `/api/health` path to Next.js.
- Release actions: upload one source archive, build/push two uniquely tagged images, create a new isolated logical database named `souvenote_mvp_staging` inside the existing RDS instance, apply verified migrations 0001-0005 there, update the existing ECS service to the current task definition, and retain the previous task-definition ARN for rollback.
- Recovery proof: take a manual staging RDS snapshot, restore it to one temporary private `db.t4g.micro`, run the migration-journal/readiness check, then delete only the temporary restore instance. The source instance and manual evidence snapshot are not deleted.
- Explicitly excluded: Marketplace, reserved capacity, Savings Plans, domains/DNS, support-plan changes, quota increases, NAT Gateway, accelerated/large compute, production resources, Bedrock/fal/OpenAI traffic, Stripe, Scribeless, SendGrid, PostHog, Sentry, SMS, physical fulfillment, and customer-facing paid traffic.

Exact command or action:

```text
npm run infra:synth
cd infra/cdk && npx cdk diff SouvenoteStagingRelease
cd infra/cdk && npx cdk deploy SouvenoteStagingRelease --require-approval never --parameters <read-only discovered existing staging values>
aws codebuild start-build ... # existing souvenote-staging-images project, unique Section 6 tag
aws ecs run-task ...          # new logical-database migration task
aws ecs update-service ...    # existing staging service, current task-definition ARN
aws rds create-db-snapshot ...
aws rds restore-db-instance-from-db-snapshot ... # temporary private restore target
aws ecs run-task ...          # verify-only task against restore target
aws rds delete-db-instance ... # temporary restore target only; skip final snapshot
aws cloudformation update-stack ... # disable/re-enable only the BFF listener rule during rollback proof
aws ecs update-service ...    # previous task definition, then current task definition
```

Infrastructure/configuration diff:

- No new VPC, NAT Gateway, ALB, CloudFront distribution, RDS source instance, S3 bucket, ECR repository, CodeBuild project, or always-on ECS service.
- Existing foundation resource identities stay unchanged. CDK owns only the current-workspace release boundary listed above.
- Steady-state compute stays at one 0.5-vCPU/1-GiB Fargate task. The worker is a separate idle container in that task; all provider modes are `disabled`.
- The current migration lineage uses a new logical database. The older divergent staging database remains byte-for-byte outside the new migration journal.
- Cognito access tokens use the provider-valid `souvenote/customer` scope and a bounded V2 pre-token trigger that copies only a verified email claim. Essentials remains within its indefinite 10,000-MAU monthly free tier at staging scale.

One-time gross cost estimate: USD 0-25 for CodeBuild minutes, image storage/scan, transient Fargate overlap, snapshot/restore I/O and temporary RDS runtime, logs, requests, and data transfer. There are no upfront commitments.

Monthly gross cost estimate: existing staging remains approximately USD 56-76 at low traffic, including the prior USD 55-75 foundation estimate and about USD 0.40 for the new BFF secret. Cognito Essentials is USD 0 below 10,000 direct/social MAU per month; Lambda/log/request costs are expected within free/near-zero staging usage. The existing USD 100 account staging budget remains the operational alert ceiling, not a hard stop.

Worst-case cost before billing refresh: USD 125, composed of the USD 100 staging monthly alert envelope plus the USD 25 bounded release/recovery allowance. Billing and credit data can lag by approximately 24 hours.

AWS credit eligibility: the packet uses standard AWS services shown in the account credit's applicable-products list. AWS applies eligible credits automatically. It excludes the published ineligible categories: Marketplace (except separately eligible Bedrock model spend), domain registration, upfront commitments, professional/training services, and ineligible support. Console evidence on 2026-08-13 showed conservative estimated credit remaining of USD 4,759.69, expiring 2028-03-31. A USD 125 gross envelope leaves USD 4,634.69 estimated credit, preserving the required USD 1,000 reserve by USD 3,634.69.

Possible cash exposure: expected USD 0 because every action is within applicable AWS services and the active credit exceeds the envelope. Maximum policy exposure is USD 125 only if AWS unexpectedly does not apply an otherwise eligible credit, the credit state changes before the action, or taxes are assessed separately. The operator must re-check the credit and stop before mutation if the conservative remaining balance is below USD 4,759.69, an applicable product is missing, or any cash-only charge appears.

Duration: deployment/recovery work through 2026-08-31; steady staging resources remain until a separately approved shutdown or later-section decision.

Rollback/shutdown procedure:

1. Record the existing ECS service task-definition ARN and desired/running counts before release.
2. If migration, health, or smoke fails, do not cut over; stop the new task and retain the old service revision.
3. If post-cutover smoke fails, disable the release-owned BFF listener rule, update the same ECS service back to the recorded task-definition ARN, and wait for steady state.
4. The old application automatically reconnects to its old logical database; no reverse migration is run.
5. The routine application rollback removes only the priority-5 route through the stack parameter and preserves the release-owned Cognito users, BFF secret, and task definitions. A separately authorized stack deletion would remove release-owned resources subject to the retained BFF secret; it cannot delete the existing staging foundation, source RDS instance, buckets, repositories, or snapshots.
6. Delete only the purpose-named temporary restore instance after successful verification. Any deletion of the failed `souvenote-staging` stack or retained foundation data requires a separate approval.

Data-loss risk: low and bounded. The current migration runner never targets the old `souvenote` database; it creates/uses only `souvenote_mvp_staging`. The source RDS instance is snapshotted before cutover. The restore test deletes only its temporary target. Staging accounts/data created after cutover live in the new database/user pool and would be unavailable during an application rollback, but neither datastore is destroyed.

Approval expiry: 2026-08-31 23:59:59 America/Vancouver, or immediately when USD 125 gross is reached, the resource/action list changes, credit eligibility changes, or a possible cash-only charge is detected.

Required explicit approval phrase:

```text
APPROVE AWS-STAGING-006 UP TO USD 125 GROSS THROUGH 2026-08-31
```

## Evidence sources

- AWS console read-only inventory, billing, credit, and CloudFormation inspection on 2026-08-13.
- [AWS promotional credit terms](https://aws.amazon.com/awscredits/) and [AWS billing credit application](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html).
- [Amazon Cognito pricing](https://aws.amazon.com/cognito/pricing/) and [pre-token-generation access-token customization](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html).
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/) and [Amazon RDS for PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/).
