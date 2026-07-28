# Souvenote AWS environments

This stack deploys the current Souvenote application to `ca-central-1` using
credit-eligible AWS services:

- CloudFront HTTPS in front of an Application Load Balancer
- one small ECS/Fargate task containing the Next.js frontend and NestJS API
- private, encrypted RDS PostgreSQL 16 with three days of backups
- private, versioned S3 assets
- Cognito customer authentication
- ECR image repositories, CodeBuild, CloudWatch Logs, and Secrets Manager

There is no NAT Gateway. Application tasks receive an ephemeral public address
for outbound provider calls, but their security group accepts inbound traffic
only from the load balancer. The load balancer accepts inbound traffic only
from the AWS-managed CloudFront origin-facing prefix list. The database has no
public route or public address.

Staging deliberately uses mock generation, checkout, fulfillment, and
notification providers and disables third-party analytics and error reporting.
This prevents external vendor charges while the AWS deployment is tested.

The expected steady-state AWS usage is roughly USD 55-75 per month at low
traffic. Actual pricing varies. The account-wide USD 100 AWS Budget is an alert,
not a hard stop, and billing data can be delayed.

## Current environment

- Stack: `souvenote-staging-v2`
- Region: `ca-central-1`
- URL: <https://d2lbqxot54qnt4.cloudfront.net>
- Budget: `Souvenote-Staging-Monthly-Account-Guardrail`

## Production preview

Production uses the same AWS account and a separate `souvenote-production`
CloudFormation stack. `production.yaml` hardens the environment with:

- a distinct VPC and private Multi-AZ PostgreSQL database;
- 14 days of database backups, deletion protection, and Performance Insights;
- production Cognito deletion protection;
- private versioned asset and deployment buckets;
- immutable ECR repositories;
- ALB deletion protection and invalid-header dropping;
- 30-day application and build log retention;
- eleven database, load-balancer, target-health, ECS, and structured
  backend-error CloudWatch alarms sent through SNS;
- a saved CloudWatch Logs Insights query for backend errors; and
- a two-to-four-task ECS autoscaling definition.

`deploy-production.sh` deploys the foundation and, only when
`DEPLOY_APPLICATION=true` is explicitly supplied, builds immutable application
images, runs migrations from the same release, and rolls out the ECS service.
When no custom domain is configured, the backend receives
`PRODUCTION_PREVIEW_MODE=true`. That explicit gate permits the AWS-only
production preview to keep generation, checkout, fulfillment, and notification
providers mocked and analytics and third-party error reporting disabled. Adding
a custom domain turns preview mode off, so a customer-facing deployment fails
closed unless production-grade providers are configured.

The account-wide `Souvenote-Project-Monthly-Guardrail` AWS Budget remains a
conservative USD 400 account guardrail. A separate
`Souvenote-Production-Monthly-Guardrail` is filtered to the
`Environment=production` cost-allocation tag and alerts at 25, 50, 80, and 100
percent actual spend plus 80 percent forecast against USD 225. AWS Budgets are
notifications, not spending hard stops, and billing data can be delayed.

`security-baseline.yaml` creates the retained, encrypted, multi-Region
`souvenote-account-audit` CloudTrail for management events. Audit objects expire
after one year.

The requested hostname is `www.souvenote.com`. DNS is currently hosted outside
AWS and the live `www` CNAME points at Google. The CloudFront alias must not be
enabled until the ACM DNS validation record is added at the DNS provider and
the existing Google-hosted site is approved for replacement.

Current production preview:

- Stack: `souvenote-production` (`UPDATE_COMPLETE`)
- Temporary CloudFront URL: <https://d2gh9cmv2togx4.cloudfront.net>
- Application service: enabled, two healthy Fargate tasks
- Release: `production-20260725T211804Z-f33f62f6`
- Provider posture: generation, checkout, fulfillment, and notifications are
  mocked; analytics, third-party error reporting, and operational provider
  alerts are disabled
- Monitoring: eleven CloudWatch alarms, all `OK`; SNS email subscription and
  controlled `ALARM`-to-`OK` delivery path verified
- Recovery: encrypted automated production snapshot restored into an isolated
  private target, verified, and the temporary target removed
- Custom domain and CloudFront aliases: not configured
- Budget: `Souvenote-Production-Monthly-Guardrail` (USD 225)
- ACM certificate: issued in `us-east-1`, deliberately not attached
- Validation CNAME name:
  `_3c0188095dfac052223cb32f8168108e.www.souvenote.com`
- Validation CNAME value:
  `_481e1cea8b21cf84dbd7d18f93ac2111.jkddzztszm.acm-validations.aws`

## Deployment

`deploy-staging.sh` is intended for AWS CloudShell under the
`cameron@souvenote.com` IAM Identity Center AdministratorAccess role. It:

1. deploys or updates the foundational CloudFormation stack;
2. uploads a source archive to the stack's private deployment bucket;
3. builds and pushes both container images with CodeBuild;
4. runs the schema-tracked migration task;
5. creates or refreshes the ECS service; and
6. waits for ECS and the public health endpoint.

The script targets the live `souvenote-staging-v2` stack by default. Override
`STACK_NAME` only when intentionally creating or updating a different stack.

`deploy-production.sh` follows the same verified-source, build, migration, and
health-check sequence for `souvenote-production`. It requires
`DEPLOY_APPLICATION=true` before it can create or update application tasks.
Every run uses a timestamped, source-hash-derived image tag so the production
ECR repositories can remain immutable. Keep `CUSTOM_DOMAIN_NAME` and
`CLOUDFRONT_CERTIFICATE_ARN` unset until the DNS switch is separately approved.

All retained S3 buckets, ECR repositories, and RDS deletion snapshots must be
reviewed separately if the stack is ever removed.
