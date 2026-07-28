# AWS operational readiness — 2026-07-25

## Scope

This report covers the Souvenote staging environment in AWS account `654047456665`, deployed in Canada (Central) as CloudFormation stack `souvenote-staging-v2`.

No production deployment, production DNS change, Google Workspace change, or activation of an external application provider was performed.

## Deployment status

- CloudFormation status: `UPDATE_COMPLETE`
- CloudFormation termination protection: enabled
- Infrastructure source: `infra/aws/staging.yaml`
- RDS PostgreSQL status: available
- RDS encryption: enabled
- RDS public access: disabled
- RDS deletion protection: enabled
- RDS automated backup retention: 7 days
- Application Load Balancer deletion protection: enabled
- Application Load Balancer invalid HTTP header dropping: enabled

## Monitoring and error reporting

Eleven staging CloudWatch alarms are deployed and were in `OK` state at verification:

1. Load balancer HTTP 5xx
2. Target HTTP 5xx
3. Frontend unhealthy host
4. Backend unhealthy host
5. ECS running-task count
6. ECS high CPU
7. ECS high memory
8. RDS high CPU
9. RDS low storage
10. RDS high connections
11. Backend structured error logs

CloudWatch-native application error reporting is enabled through:

- A structured JSON metric filter on `/aws/ecs/souvenote/staging/backend`
- Metric `Souvenote/Observability / BackendErrorCount`
- Saved Logs Insights query `Souvenote/staging/Backend errors`
- Fourteen-day application and build-log retention

The alarm SNS topic is `souvenote-staging-alarms`. Its email subscription to `cameron@souvenote.com` is confirmed.

An end-to-end AWS alarm-path test was completed on `souvenote-staging-backend-error-log`. The alarm was deliberately moved to `ALARM`, then restored to `OK`. CloudWatch history recorded successful execution of the SNS action for both transitions, and the alarm's final state was verified as `OK`.

## Backup restore drill

An isolated restore was created from automated snapshot:

`rds:souvenote-staging-2026-07-25-10-05`

The restored database reached `available` and was verified as:

- PostgreSQL 16.9
- `db.t4g.micro`
- 20 GB
- Encrypted
- Not publicly accessible

The temporary restore target `souvenote-staging-restore-drill-20260725` was then deleted. AWS returned `DBInstanceNotFound` during the final existence check, confirming cleanup. Temporary CloudShell transfer and drill files were also removed.

## Cost controls

The staging monthly budget is `$100 USD`; the project budget is `$400 USD`.

Both budgets now notify at:

- Actual: 25%, 50%, 80%, and 100%
- Forecast: 80%

Cost Anomaly Detection is configured for daily notification to the confirmed address `cameron@souvenote.com` when absolute impact reaches `$5 USD`.

## Cost position

AWS Cost Explorer for July 1–25, 2026 reported:

- Gross usage: `$13.9584425432 USD`
- AWS credits: `-$13.9584425423 USD`
- Net unblended cost: approximately `$0.00 USD`
- AWS Budgets July staging forecast: `$17.923 USD`

The saved AWS Pricing Calculator estimate for an always-on staging month is:

- Monthly: `$67.67 USD`
- Twelve months: `$812.04 USD`
- Upfront: `$0.00 USD`

Estimate components:

| Service | Monthly estimate |
|---|---:|
| RDS PostgreSQL | $15.68 |
| ECS Fargate | $19.81 |
| Application Load Balancer | $18.08 |
| Three public IPv4 addresses | $10.95 |
| Secrets Manager | $1.20 |
| CloudWatch | $1.95 |
| CloudFront at expected low staging traffic | $0.00 |
| **Total** | **$67.67** |

Saved estimate:

https://calculator.aws/#/estimate?id=c6e9a59a7f867726e2bc5619c9736d8b4d43aded

The calculator link is obscure but publicly accessible and expires after one year. The estimate excludes taxes and assumes low staging traffic. Small S3, ECR, CodeBuild, Cognito, SNS, and variable data-transfer charges may add a few dollars, so a practical operating expectation is approximately `$70–$75 USD/month`. AWS credits currently offset eligible usage, but AWS does not guarantee that every charge will be credit-eligible or that a payment card will never be charged.

## Operational follow-up

No AWS configuration action remains for this safeguard. Confirm that the two controlled test messages—one `ALARM` and one `OK`—arrived at `cameron@souvenote.com`; check the spam folder if necessary.
