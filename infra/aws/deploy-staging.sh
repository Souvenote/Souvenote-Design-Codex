#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ca-central-1}"
STACK_NAME="${STACK_NAME:-souvenote-staging-v2}"
SOURCE_ZIP="${1:-$HOME/souvenote-source.zip}"

if [[ ! -f "$SOURCE_ZIP" ]]; then
  echo "Source archive not found: $SOURCE_ZIP" >&2
  exit 1
fi

stack_output() {
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

cleanup_unavailable_change_sets() {
  while IFS= read -r change_set; do
    [[ -z "$change_set" ]] && continue
    aws cloudformation delete-change-set \
      --region "$REGION" \
      --stack-name "$STACK_NAME" \
      --change-set-name "$change_set" >/dev/null 2>&1 || true
  done < <(
    aws cloudformation list-change-sets \
      --region "$REGION" \
      --stack-name "$STACK_NAME" \
      --query "Summaries[?Status=='FAILED' || ExecutionStatus=='UNAVAILABLE'].ChangeSetName" \
      --output text 2>/dev/null | tr '\t' '\n' || true
  )
}

cleanup_unavailable_change_sets
trap cleanup_unavailable_change_sets EXIT

CURRENT_DEPLOYMENT="$(
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='DeployApplication'].ParameterValue | [0]" \
    --output text 2>/dev/null || true
)"
if [[ "$CURRENT_DEPLOYMENT" != "true" ]]; then
  CURRENT_DEPLOYMENT=false
fi

CLOUDFRONT_PREFIX_LIST_ID="$(
  aws ec2 describe-managed-prefix-lists \
    --region "$REGION" \
    --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
    --query 'PrefixLists[0].PrefixListId' \
    --output text
)"
if [[ -z "$CLOUDFRONT_PREFIX_LIST_ID" || "$CLOUDFRONT_PREFIX_LIST_ID" == "None" ]]; then
  echo "Could not resolve the AWS-managed CloudFront origin prefix list." >&2
  exit 1
fi

echo "Deploying foundational infrastructure..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/staging.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "DeployApplication=$CURRENT_DEPLOYMENT" \
    "CloudFrontOriginPrefixListId=$CLOUDFRONT_PREFIX_LIST_ID" \
  --tags Project=Souvenote Environment=staging ManagedBy=CloudFormation

SOURCE_BUCKET="$(stack_output DeploymentSourceBucketName)"
BUILD_PROJECT="$(stack_output BuildProjectName)"

echo "Uploading the versioned source archive..."
aws s3 cp \
  --region "$REGION" \
  --sse AES256 \
  "$SOURCE_ZIP" \
  "s3://$SOURCE_BUCKET/souvenote-source.zip"

echo "Building application images..."
BUILD_ID="$(
  aws codebuild start-build \
    --region "$REGION" \
    --project-name "$BUILD_PROJECT" \
    --query 'build.id' \
    --output text
)"

while true; do
  BUILD_STATUS="$(
    aws codebuild batch-get-builds \
      --region "$REGION" \
      --ids "$BUILD_ID" \
      --query 'builds[0].buildStatus' \
      --output text
  )"
  echo "CodeBuild status: $BUILD_STATUS"
  case "$BUILD_STATUS" in
    SUCCEEDED) break ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      aws codebuild batch-get-builds \
        --region "$REGION" \
        --ids "$BUILD_ID" \
        --query 'builds[0].logs.deepLink' \
        --output text
      exit 1
      ;;
  esac
  sleep 10
done

CLUSTER_NAME="$(stack_output ClusterName)"
MIGRATION_TASK="$(stack_output MigrationTaskDefinitionArn)"
PUBLIC_SUBNET_A="$(stack_output PublicSubnetAId)"
PUBLIC_SUBNET_B="$(stack_output PublicSubnetBId)"
APPLICATION_SECURITY_GROUP="$(stack_output ApplicationSecurityGroupId)"

echo "Applying database migrations..."
MIGRATION_TASK_ARN="$(
  aws ecs run-task \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --task-definition "$MIGRATION_TASK" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_A,$PUBLIC_SUBNET_B],securityGroups=[$APPLICATION_SECURITY_GROUP],assignPublicIp=ENABLED}" \
    --query 'tasks[0].taskArn' \
    --output text
)"
if [[ -z "$MIGRATION_TASK_ARN" || "$MIGRATION_TASK_ARN" == "None" ]]; then
  echo "The migration task did not start." >&2
  exit 1
fi
aws ecs wait tasks-stopped \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --tasks "$MIGRATION_TASK_ARN"
MIGRATION_EXIT_CODE="$(
  aws ecs describe-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --tasks "$MIGRATION_TASK_ARN" \
    --query "tasks[0].containers[?name=='backend'].exitCode | [0]" \
    --output text
)"
if [[ "$MIGRATION_EXIT_CODE" != "0" ]]; then
  aws ecs describe-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --tasks "$MIGRATION_TASK_ARN" \
    --query 'tasks[0].containers[0].[reason,exitCode]' \
    --output table
  exit 1
fi

echo "Deploying the application service..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/staging.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    DeployApplication=true \
    "CloudFrontOriginPrefixListId=$CLOUDFRONT_PREFIX_LIST_ID" \
  --tags Project=Souvenote Environment=staging ManagedBy=CloudFormation

SERVICE_NAME="$(stack_output ServiceName)"
aws ecs update-service \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --force-new-deployment >/dev/null
aws ecs wait services-stable \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME"

FRONTEND_URL="$(stack_output CloudFrontUrl)"
HEALTH_URL="$(stack_output BackendHealthUrl)"
echo "Waiting for CloudFront and application health..."
for attempt in {1..60}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    echo "Souvenote staging is healthy: $FRONTEND_URL"
    exit 0
  fi
  echo "Health check attempt $attempt/60 is not ready yet."
  sleep 10
done

echo "The service is stable, but the CloudFront health endpoint did not become ready." >&2
exit 1
