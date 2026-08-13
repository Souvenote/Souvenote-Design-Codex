# Infrastructure approval boundary

Section 6 defines an assetless CDK release stack in `cdk/`, two application images in `docker/`, and approval-gated staging orchestration in `aws/`. The release stack deliberately imports the existing `souvenote-staging-v2` foundation instead of duplicating its VPC, load balancer, CloudFront distribution, RDS instance, repositories, build project, buckets, ECS cluster, or service.

Static synthesis and tests are non-mutating. `aws/deploy-staging.sh` is the sole Section 6 mutation entry point and fails closed unless the exact approval metadata from `docs/operations/section-6-aws-staging-approval.md` is supplied. It records the previous task definition, uses a separate logical database, proves a snapshot restore, exercises an application rollback, and restores the current release. Every non-AWS provider remains disabled.

Ordinary CI remains non-deploying and no deployment credentials belong in repository workflows. Any later deployment, rollback, resource deletion, provider activation, or cost-envelope change requires the approval policy in `docs/operations/cost-approval.md`.
