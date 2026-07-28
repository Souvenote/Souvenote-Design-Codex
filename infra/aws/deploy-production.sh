#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ca-central-1}"
STACK_NAME="${STACK_NAME:-souvenote-production}"
CUSTOM_DOMAIN_NAME="${CUSTOM_DOMAIN_NAME:-}"
CLOUDFRONT_CERTIFICATE_ARN="${CLOUDFRONT_CERTIFICATE_ARN:-}"
ALERT_EMAIL="${ALERT_EMAIL:-cameron@souvenote.com}"
DEPLOY_APPLICATION="${DEPLOY_APPLICATION:-false}"
SOURCE_ZIP="${1:-$HOME/souvenote-source.zip}"

if [[ -n "$CUSTOM_DOMAIN_NAME" && -z "$CLOUDFRONT_CERTIFICATE_ARN" ]]; then
  echo "CLOUDFRONT_CERTIFICATE_ARN is required when CUSTOM_DOMAIN_NAME is set." >&2
  exit 1
fi
if [[ -z "$CUSTOM_DOMAIN_NAME" && -n "$CLOUDFRONT_CERTIFICATE_ARN" ]]; then
  echo "CUSTOM_DOMAIN_NAME is required when CLOUDFRONT_CERTIFICATE_ARN is set." >&2
  exit 1
fi
if [[ "$DEPLOY_APPLICATION" != "true" && "$DEPLOY_APPLICATION" != "false" ]]; then
  echo "DEPLOY_APPLICATION must be either true or false." >&2
  exit 1
fi
if [[ "$DEPLOY_APPLICATION" == "true" && ! -f "$SOURCE_ZIP" ]]; then
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
CURRENT_BACKEND_IMAGE_TAG="$(
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='BackendImageTag'].ParameterValue | [0]" \
    --output text 2>/dev/null || true
)"
if [[ -z "$CURRENT_BACKEND_IMAGE_TAG" || "$CURRENT_BACKEND_IMAGE_TAG" == "None" ]]; then
  CURRENT_BACKEND_IMAGE_TAG=production-bootstrap
fi
CURRENT_FRONTEND_IMAGE_TAG="$(
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='FrontendImageTag'].ParameterValue | [0]" \
    --output text 2>/dev/null || true
)"
if [[ -z "$CURRENT_FRONTEND_IMAGE_TAG" || "$CURRENT_FRONTEND_IMAGE_TAG" == "None" ]]; then
  CURRENT_FRONTEND_IMAGE_TAG=production-bootstrap
fi
CURRENT_MIGRATION_IMAGE_TAG="$(
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='MigrationImageTag'].ParameterValue | [0]" \
    --output text 2>/dev/null || true
)"
if [[ -z "$CURRENT_MIGRATION_IMAGE_TAG" || "$CURRENT_MIGRATION_IMAGE_TAG" == "None" ]]; then
  CURRENT_MIGRATION_IMAGE_TAG="$CURRENT_BACKEND_IMAGE_TAG"
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

echo "Deploying or refreshing the hardened production foundation..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/production.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    EnvironmentName=production \
    "DeployApplication=$CURRENT_DEPLOYMENT" \
    "BackendImageTag=$CURRENT_BACKEND_IMAGE_TAG" \
    "FrontendImageTag=$CURRENT_FRONTEND_IMAGE_TAG" \
    "MigrationImageTag=$CURRENT_MIGRATION_IMAGE_TAG" \
    DatabaseInstanceClass=db.t4g.small \
    "CloudFrontOriginPrefixListId=$CLOUDFRONT_PREFIX_LIST_ID" \
    "CustomDomainName=$CUSTOM_DOMAIN_NAME" \
    "CloudFrontCertificateArn=$CLOUDFRONT_CERTIFICATE_ARN" \
    "AlertEmail=$ALERT_EMAIL" \
  --tags Project=Souvenote Environment=production ManagedBy=CloudFormation

if [[ "$DEPLOY_APPLICATION" != "true" ]]; then
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].{Status:StackStatus,Url:Outputs[?OutputKey==`CloudFrontUrl`].OutputValue|[0],Database:Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue|[0]}' \
    --output table
  echo "Production foundation is ready. Set DEPLOY_APPLICATION=true and pass a verified source archive to deploy the application."
  exit 0
fi

SOURCE_BUCKET="$(stack_output DeploymentSourceBucketName)"
BUILD_PROJECT="$(stack_output BuildProjectName)"
SOURCE_SHA256="$(sha256sum "$SOURCE_ZIP" | awk '{print $1}')"
RELEASE_TAG="${RELEASE_TAG:-production-$(date -u +%Y%m%dT%H%M%SZ)-${SOURCE_SHA256:0:8}}"
if [[ ! "$RELEASE_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "RELEASE_TAG is not a valid ECR image tag." >&2
  exit 1
fi

echo "Uploading the verified production source archive..."
aws s3 cp \
  --region "$REGION" \
  --sse AES256 \
  "$SOURCE_ZIP" \
  "s3://$SOURCE_BUCKET/souvenote-source.zip"

echo "Building production application images..."
BUILD_ID="$(
  aws codebuild start-build \
    --region "$REGION" \
    --project-name "$BUILD_PROJECT" \
    --environment-variables-override \
      "name=BACKEND_IMAGE_TAG,value=$RELEASE_TAG,type=PLAINTEXT" \
      "name=FRONTEND_IMAGE_TAG,value=$RELEASE_TAG,type=PLAINTEXT" \
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

echo "Updating the production migration task to release $RELEASE_TAG..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/production.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    EnvironmentName=production \
    "DeployApplication=$CURRENT_DEPLOYMENT" \
    "BackendImageTag=$CURRENT_BACKEND_IMAGE_TAG" \
    "FrontendImageTag=$CURRENT_FRONTEND_IMAGE_TAG" \
    "MigrationImageTag=$RELEASE_TAG" \
    DatabaseInstanceClass=db.t4g.small \
    "CloudFrontOriginPrefixListId=$CLOUDFRONT_PREFIX_LIST_ID" \
    "CustomDomainName=$CUSTOM_DOMAIN_NAME" \
    "CloudFrontCertificateArn=$CLOUDFRONT_CERTIFICATE_ARN" \
    "AlertEmail=$ALERT_EMAIL" \
  --tags Project=Souvenote Environment=production ManagedBy=CloudFormation

CLUSTER_NAME="$(stack_output ClusterName)"
MIGRATION_TASK="$(stack_output MigrationTaskDefinitionArn)"
PUBLIC_SUBNET_A="$(stack_output PublicSubnetAId)"
PUBLIC_SUBNET_B="$(stack_output PublicSubnetBId)"
APPLICATION_SECURITY_GROUP="$(stack_output ApplicationSecurityGroupId)"

echo "Applying production database migrations..."
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
  echo "The production migration task did not start." >&2
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

echo "Enabling the production application service without a custom domain..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/production.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    EnvironmentName=production \
    DeployApplication=true \
    "BackendImageTag=$RELEASE_TAG" \
    "FrontendImageTag=$RELEASE_TAG" \
    "MigrationImageTag=$RELEASE_TAG" \
    DatabaseInstanceClass=db.t4g.small \
    "CloudFrontOriginPrefixListId=$CLOUDFRONT_PREFIX_LIST_ID" \
    "CustomDomainName=$CUSTOM_DOMAIN_NAME" \
    "CloudFrontCertificateArn=$CLOUDFRONT_CERTIFICATE_ARN" \
    "AlertEmail=$ALERT_EMAIL" \
  --tags Project=Souvenote Environment=production ManagedBy=CloudFormation

FRONTEND_URL="$(stack_output CloudFrontUrl)"
HEALTH_URL="$(stack_output BackendHealthUrl)"
echo "Waiting for CloudFront and production application health..."
for attempt in {1..60}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    echo "Souvenote production is healthy at the AWS URL: $FRONTEND_URL"
    break
  fi
  echo "Health check attempt $attempt/60 is not ready yet."
  sleep 10
done
if ! curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
  echo "The production service is stable, but the CloudFront health endpoint did not become ready." >&2
  exit 1
fi

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].{Status:StackStatus,Url:Outputs[?OutputKey==`CloudFrontUrl`].OutputValue|[0],Database:Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue|[0]}' \
  --output table

echo "Production is running in AWS preview mode. No custom-domain or external DNS changes were made."
