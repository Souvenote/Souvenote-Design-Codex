#!/usr/bin/env bash
set -euo pipefail

EVIDENCE_FILE="${1:-infra/aws/section6-release-evidence.local.json}"
MODE="${2:---rollback-only}"
[[ -f "$EVIDENCE_FILE" ]]
[[ "$(jq -r '.approvalId' "$EVIDENCE_FILE")" == "AWS-STAGING-006" ]]
[[ "$MODE" == "--rollback-only" || "$MODE" == "--prove-and-restore" ]]

REGION="${AWS_DEFAULT_REGION:-ca-central-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
FOUNDATION_STACK="souvenote-staging-v2"
RELEASE_STACK="souvenote-staging-release"
[[ "$ACCOUNT_ID" == "654047456665" ]]
[[ "$REGION" == "ca-central-1" ]]

stack_output() {
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$FOUNDATION_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

set_bff_routing() {
  local enabled="$1"
  local current
  local parameters
  current="$(aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$RELEASE_STACK" \
    --query "Stacks[0].Parameters[?ParameterKey=='BffRoutingEnabled'].ParameterValue | [0]" \
    --output text)"
  if [[ "$current" == "$enabled" ]]; then
    return
  fi
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

update_service() {
  local task_definition="$1"
  aws ecs update-service \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$task_definition" \
    >/dev/null
  aws ecs wait services-stable --region "$REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME"
}

CLUSTER_NAME="$(stack_output ClusterName)"
SERVICE_NAME="$(stack_output ServiceName)"
PUBLIC_ORIGIN="$(stack_output CloudFrontUrl)"
PREVIOUS_TASK_DEFINITION="$(jq -r '.previousTaskDefinition' "$EVIDENCE_FILE")"
APPLICATION_TASK_DEFINITION="$(jq -r '.applicationTaskDefinition' "$EVIDENCE_FILE")"
[[ "$PREVIOUS_TASK_DEFINITION" == arn:aws:ecs:ca-central-1:654047456665:task-definition/* ]]
[[ "$APPLICATION_TASK_DEFINITION" == arn:aws:ecs:ca-central-1:654047456665:task-definition/* ]]

set_bff_routing false
update_service "$PREVIOUS_TASK_DEFINITION"
curl --fail --silent --show-error "$PUBLIC_ORIGIN/" >/dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/api/health" >/dev/null

if [[ "$MODE" == "--rollback-only" ]]; then
  echo "Staging rolled back to $PREVIOUS_TASK_DEFINITION; neither database was modified or deleted."
  exit 0
fi

update_service "$APPLICATION_TASK_DEFINITION"
set_bff_routing true
infra/aws/smoke-staging.sh "$PUBLIC_ORIGIN"

UPDATED_EVIDENCE="$(mktemp)"
jq '.rollback = "passed" | .forwardRestore = "passed"' "$EVIDENCE_FILE" > "$UPDATED_EVIDENCE"
mv "$UPDATED_EVIDENCE" "$EVIDENCE_FILE"
echo "Rollback to $PREVIOUS_TASK_DEFINITION and forward restore to $APPLICATION_TASK_DEFINITION both passed."
