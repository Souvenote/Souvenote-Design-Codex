#!/usr/bin/env bash
set -euo pipefail

# Section 6 mutation entry point. Run from the repository root in AWS CloudShell
# only after the exact approval phrase in the durable packet is recorded.

: "${APPROVAL_ID:?Set APPROVAL_ID to the recorded approval ID}"
: "${APPROVAL_MAX_GROSS_USD:?Set the approved gross USD ceiling}"
: "${APPROVAL_EXPIRES:?Set the approval expiry date}"

[[ "$APPROVAL_ID" == "AWS-STAGING-006" ]]
[[ "$APPROVAL_MAX_GROSS_USD" == "125" ]]
[[ "$APPROVAL_EXPIRES" == "2026-08-31" ]]

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGION="${AWS_DEFAULT_REGION:-ca-central-1}"
FOUNDATION_STACK="souvenote-staging-v2"
RELEASE_STACK="souvenote-staging-release"
[[ "$ACCOUNT_ID" == "654047456665" ]]
[[ "$REGION" == "ca-central-1" ]]

node scripts/check-toolchain.mjs
npm run infra:approval:check
git diff --quiet
git diff --cached --quiet
SOURCE_COMMIT="$(git rev-parse HEAD)"
RELEASE_TAG="section6-$(date -u +%Y%m%dT%H%M%SZ)-${SOURCE_COMMIT:0:12}"
SNAPSHOT_ID="souvenote-section6-${RELEASE_TAG,,}"
RESTORE_ID="souvenote-restore-${RELEASE_TAG#section6-}"
RESTORE_ID="${RESTORE_ID,,}"
EVIDENCE_FILE="infra/aws/section6-release-evidence.local.json"
ARCHIVE_PATH=""
CUTOVER_STARTED=false
RESTORE_CREATED=false

failure_cleanup() {
  local status="$?"
  [[ -n "$ARCHIVE_PATH" ]] && rm -f "$ARCHIVE_PATH"
  if [[ "$status" == "0" ]]; then
    return
  fi

  trap - EXIT
  if [[ "$CUTOVER_STARTED" == "true" && -f "$EVIDENCE_FILE" ]]; then
    infra/aws/rollback-staging.sh "$EVIDENCE_FILE" --rollback-only || \
      echo "Automatic application rollback failed; use the recorded evidence file immediately." >&2
  fi
  if [[ "$RESTORE_CREATED" == "true" ]] && aws rds describe-db-instances \
    --region "$REGION" --db-instance-identifier "$RESTORE_ID" >/dev/null 2>&1; then
    aws rds delete-db-instance \
      --region "$REGION" \
      --db-instance-identifier "$RESTORE_ID" \
      --skip-final-snapshot \
      --delete-automated-backups \
      >/dev/null || echo "Temporary restore cleanup failed for $RESTORE_ID; delete that exact target only." >&2
  fi
  exit "$status"
}
trap failure_cleanup EXIT

stack_output() {
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$FOUNDATION_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

stack_resource() {
  aws cloudformation describe-stack-resource \
    --region "$REGION" \
    --stack-name "$FOUNDATION_STACK" \
    --logical-resource-id "$1" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text
}

set_release_bff_routing() {
  local enabled="$1"
  local parameters
  parameters="$(aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$RELEASE_STACK" \
    --output json | jq -c --arg enabled "$enabled" '
      [.Stacks[0].Parameters[]
        | if .ParameterKey == "BffRoutingEnabled"
          then {ParameterKey: .ParameterKey, ParameterValue: $enabled}
          else {ParameterKey: .ParameterKey, UsePreviousValue: true}
          end]')"
  aws cloudformation update-stack \
    --region "$REGION" \
    --stack-name "$RELEASE_STACK" \
    --use-previous-template \
    --parameters "$parameters" \
    --capabilities CAPABILITY_IAM \
    >/dev/null
  aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$RELEASE_STACK"
}

BACKEND_REPOSITORY_URI="$(stack_output BackendRepositoryUri)"
FRONTEND_REPOSITORY_URI="$(stack_output FrontendRepositoryUri)"
PUBLIC_ORIGIN="$(stack_output CloudFrontUrl)"
DATABASE_HOST="$(stack_output DatabaseEndpoint)"
DEPLOYMENT_BUCKET="$(stack_output DeploymentSourceBucketName)"
BUILD_PROJECT="$(stack_output BuildProjectName)"
CLUSTER_NAME="$(stack_output ClusterName)"
SERVICE_NAME="$(stack_output ServiceName)"
MIGRATION_SUBNET_A="$(stack_output PublicSubnetAId)"
MIGRATION_SUBNET_B="$(stack_output PublicSubnetBId)"
APPLICATION_SECURITY_GROUP="$(stack_output ApplicationSecurityGroupId)"
LISTENER_ARN="$(stack_resource LoadBalancerListener)"
FRONTEND_TARGET_GROUP_ARN="$(stack_resource FrontendTargetGroup)"
DATABASE_ID="$(stack_resource Database)"
DATABASE_SECRET_ARN="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DATABASE_ID" --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)"

for value in \
  "$BACKEND_REPOSITORY_URI" "$FRONTEND_REPOSITORY_URI" "$PUBLIC_ORIGIN" \
  "$DATABASE_HOST" "$DEPLOYMENT_BUCKET" "$BUILD_PROJECT" "$CLUSTER_NAME" \
  "$SERVICE_NAME" "$LISTENER_ARN" "$FRONTEND_TARGET_GROUP_ARN" "$DATABASE_SECRET_ARN"; do
  [[ -n "$value" && "$value" != "None" ]]
done

PREVIOUS_TASK_DEFINITION="$(aws ecs describe-services --region "$REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].taskDefinition' --output text)"
PREVIOUS_DESIRED_COUNT="$(aws ecs describe-services --region "$REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].desiredCount' --output text)"

npm run infra:synth
(
  cd infra/cdk
  npx cdk diff SouvenoteStagingRelease \
    --parameters "BackendRepositoryUri=$BACKEND_REPOSITORY_URI" \
    --parameters "FrontendRepositoryUri=$FRONTEND_REPOSITORY_URI" \
    --parameters "ReleaseTag=$RELEASE_TAG" \
    --parameters "PublicOrigin=$PUBLIC_ORIGIN" \
    --parameters "DatabaseHost=$DATABASE_HOST" \
    --parameters "DatabaseSecretArn=$DATABASE_SECRET_ARN" \
    --parameters "ExistingListenerArn=$LISTENER_ARN" \
    --parameters "ExistingFrontendTargetGroupArn=$FRONTEND_TARGET_GROUP_ARN" \
    --parameters "BffRoutingEnabled=false"
)

ARCHIVE_PATH="$(mktemp --suffix=.zip)"
git archive --format=zip --output "$ARCHIVE_PATH" HEAD
aws s3 cp "$ARCHIVE_PATH" "s3://$DEPLOYMENT_BUCKET/souvenote-source.zip" \
  --region "$REGION" \
  --sse AES256 \
  --only-show-errors

BUILD_ID="$(aws codebuild start-build \
  --region "$REGION" \
  --project-name "$BUILD_PROJECT" \
  --environment-variables-override \
    "name=AWS_ACCOUNT_ID,value=$ACCOUNT_ID,type=PLAINTEXT" \
    "name=BACKEND_REPOSITORY_URI,value=$BACKEND_REPOSITORY_URI,type=PLAINTEXT" \
    "name=FRONTEND_REPOSITORY_URI,value=$FRONTEND_REPOSITORY_URI,type=PLAINTEXT" \
    "name=RELEASE_TAG,value=$RELEASE_TAG,type=PLAINTEXT" \
  --query 'build.id' --output text)"

while true; do
  BUILD_STATUS="$(aws codebuild batch-get-builds --region "$REGION" --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)"
  case "$BUILD_STATUS" in
    SUCCEEDED) break ;;
    FAILED|FAULT|STOPPED|TIMED_OUT) echo "CodeBuild failed: $BUILD_ID ($BUILD_STATUS)" >&2; exit 1 ;;
  esac
  sleep 15
done

(
  cd infra/cdk
  npx cdk deploy SouvenoteStagingRelease \
    --require-approval never \
    --outputs-file cdk.out/section6-outputs.json \
    --parameters "BackendRepositoryUri=$BACKEND_REPOSITORY_URI" \
    --parameters "FrontendRepositoryUri=$FRONTEND_REPOSITORY_URI" \
    --parameters "ReleaseTag=$RELEASE_TAG" \
    --parameters "PublicOrigin=$PUBLIC_ORIGIN" \
    --parameters "DatabaseHost=$DATABASE_HOST" \
    --parameters "DatabaseSecretArn=$DATABASE_SECRET_ARN" \
    --parameters "ExistingListenerArn=$LISTENER_ARN" \
    --parameters "ExistingFrontendTargetGroupArn=$FRONTEND_TARGET_GROUP_ARN" \
    --parameters "BffRoutingEnabled=false"
)

APPLICATION_TASK_DEFINITION="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$RELEASE_STACK" --query "Stacks[0].Outputs[?OutputKey=='ApplicationTaskDefinitionArn'].OutputValue | [0]" --output text)"
MIGRATION_TASK_DEFINITION="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$RELEASE_STACK" --query "Stacks[0].Outputs[?OutputKey=='MigrationTaskDefinitionArn'].OutputValue | [0]" --output text)"

NETWORK_CONFIGURATION="awsvpcConfiguration={subnets=[$MIGRATION_SUBNET_A,$MIGRATION_SUBNET_B],securityGroups=[$APPLICATION_SECURITY_GROUP],assignPublicIp=ENABLED}"
MIGRATION_TASK_ARN="$(aws ecs run-task \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --launch-type FARGATE \
  --task-definition "$MIGRATION_TASK_DEFINITION" \
  --network-configuration "$NETWORK_CONFIGURATION" \
  --query 'tasks[0].taskArn' --output text)"
aws ecs wait tasks-stopped --region "$REGION" --cluster "$CLUSTER_NAME" --tasks "$MIGRATION_TASK_ARN"
MIGRATION_EXIT="$(aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER_NAME" --tasks "$MIGRATION_TASK_ARN" --query "tasks[0].containers[?name=='migration'].exitCode | [0]" --output text)"
[[ "$MIGRATION_EXIT" == "0" ]]

aws rds create-db-snapshot \
  --region "$REGION" \
  --db-instance-identifier "$DATABASE_ID" \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --tags Key=Project,Value=Souvenote Key=Environment,Value=staging Key=Purpose,Value=section6-restore-proof \
  >/dev/null
aws rds wait db-snapshot-completed --region "$REGION" --db-snapshot-identifier "$SNAPSHOT_ID"

jq -n \
  --arg approvalId "$APPROVAL_ID" \
  --arg applicationTaskDefinition "$APPLICATION_TASK_DEFINITION" \
  --arg buildId "$BUILD_ID" \
  --arg migrationTaskDefinition "$MIGRATION_TASK_DEFINITION" \
  --arg previousTaskDefinition "$PREVIOUS_TASK_DEFINITION" \
  --arg releaseTag "$RELEASE_TAG" \
  --arg restoreSnapshot "$SNAPSHOT_ID" \
  --arg sourceCommit "$SOURCE_COMMIT" \
  '{approvalId:$approvalId,applicationTaskDefinition:$applicationTaskDefinition,buildId:$buildId,migrationTaskDefinition:$migrationTaskDefinition,previousTaskDefinition:$previousTaskDefinition,releaseTag:$releaseTag,restoreSnapshot:$restoreSnapshot,sourceCommit:$sourceCommit,smoke:"pending",restore:"pending",rollback:"pending"}' \
  > "$EVIDENCE_FILE"

CUTOVER_STARTED=true
aws ecs update-service \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --task-definition "$APPLICATION_TASK_DEFINITION" \
  --desired-count "$PREVIOUS_DESIRED_COUNT" \
  >/dev/null
aws ecs wait services-stable --region "$REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME"

set_release_bff_routing true
infra/aws/smoke-staging.sh "$PUBLIC_ORIGIN"
UPDATED_EVIDENCE="$(mktemp)"
jq '.smoke = "passed"' "$EVIDENCE_FILE" > "$UPDATED_EVIDENCE"
mv "$UPDATED_EVIDENCE" "$EVIDENCE_FILE"

DB_DETAILS="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DATABASE_ID")"
DB_SUBNET_GROUP="$(jq -r '.DBInstances[0].DBSubnetGroup.DBSubnetGroupName' <<<"$DB_DETAILS")"
mapfile -t DB_SECURITY_GROUPS < <(jq -r '.DBInstances[0].VpcSecurityGroups[].VpcSecurityGroupId' <<<"$DB_DETAILS")
[[ "${#DB_SECURITY_GROUPS[@]}" -gt 0 ]]
RESTORE_CREATED=true
aws rds restore-db-instance-from-db-snapshot \
  --region "$REGION" \
  --db-instance-identifier "$RESTORE_ID" \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --db-instance-class db.t4g.micro \
  --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --vpc-security-group-ids "${DB_SECURITY_GROUPS[@]}" \
  --no-publicly-accessible \
  --no-multi-az \
  --tags Key=Project,Value=Souvenote Key=Environment,Value=staging Key=Purpose,Value=section6-temporary-restore \
  >/dev/null
aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$RESTORE_ID"
RESTORE_HOST="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$RESTORE_ID" --query 'DBInstances[0].Endpoint.Address' --output text)"

RESTORE_TASK_ARN="$(aws ecs run-task \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --launch-type FARGATE \
  --task-definition "$MIGRATION_TASK_DEFINITION" \
  --network-configuration "$NETWORK_CONFIGURATION" \
  --overrides "{\"containerOverrides\":[{\"name\":\"migration\",\"command\":[\"node\",\"database/migrate.mjs\",\"--check\"],\"environment\":[{\"name\":\"DATABASE_HOST\",\"value\":\"$RESTORE_HOST\"}]}]}" \
  --query 'tasks[0].taskArn' --output text)"
aws ecs wait tasks-stopped --region "$REGION" --cluster "$CLUSTER_NAME" --tasks "$RESTORE_TASK_ARN"
RESTORE_EXIT="$(aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER_NAME" --tasks "$RESTORE_TASK_ARN" --query "tasks[0].containers[?name=='migration'].exitCode | [0]" --output text)"
[[ "$RESTORE_EXIT" == "0" ]]

aws rds delete-db-instance --region "$REGION" --db-instance-identifier "$RESTORE_ID" --skip-final-snapshot --delete-automated-backups >/dev/null
aws rds wait db-instance-deleted --region "$REGION" --db-instance-identifier "$RESTORE_ID"
RESTORE_CREATED=false

UPDATED_EVIDENCE="$(mktemp)"
jq '.restore = "passed"' "$EVIDENCE_FILE" > "$UPDATED_EVIDENCE"
mv "$UPDATED_EVIDENCE" "$EVIDENCE_FILE"

infra/aws/rollback-staging.sh "$EVIDENCE_FILE" --prove-and-restore

echo "Section 6 staging deployment, smoke, snapshot restore, rollback, forward restore, and cleanup passed for $RELEASE_TAG."
