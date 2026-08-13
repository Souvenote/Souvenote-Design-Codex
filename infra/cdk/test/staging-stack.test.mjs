import assert from 'node:assert/strict';
import test from 'node:test';
import { App, assertions } from 'aws-cdk-lib';
import { synthesizeStagingTemplate } from '../lib/staging-stack.mjs';

function template() {
  const app = new App();
  return assertions.Template.fromStack(synthesizeStagingTemplate(app)).toJSON();
}

test('reuses the existing staging foundation instead of duplicating expensive resources', () => {
  const synthesized = template();
  const resources = Object.values(synthesized.Resources);
  const types = resources.map((resource) => resource.Type);
  for (const forbidden of [
    'AWS::EC2::VPC',
    'AWS::ECS::Service',
    'AWS::ElasticLoadBalancingV2::LoadBalancer',
    'AWS::RDS::DBInstance',
    'AWS::S3::Bucket',
  ]) {
    assert.equal(types.includes(forbidden), false, `${forbidden} must be imported/reused, not created`);
  }
  assert.equal(types.filter((type) => type === 'AWS::ECS::TaskDefinition').length, 2);
  assert.equal(types.filter((type) => type === 'AWS::ElasticLoadBalancingV2::ListenerRule').length, 1);
  assert.equal('BootstrapVersion' in synthesized.Parameters, false);
});

test('keeps every external provider disabled in application and worker containers', () => {
  const resources = Object.values(template().Resources);
  const task = resources.find(
    (resource) =>
      resource.Type === 'AWS::ECS::TaskDefinition' && resource.Properties.Family === 'souvenote-staging-section6',
  );
  assert.ok(task);
  const providerValues = task.Properties.ContainerDefinitions.flatMap((container) => container.Environment ?? [])
    .filter((entry) => entry.Name?.endsWith('_PROVIDER_MODE'))
    .map((entry) => entry.Value);
  assert.ok(providerValues.length >= 7);
  assert.deepEqual(new Set(providerValues), new Set(['disabled']));
  assert.equal(JSON.stringify(task).includes('STRIPE_'), false);
  assert.equal(JSON.stringify(task).includes('SCRIBELESS_API_KEY'), false);
});

test('bounds staging compute and protects the BFF secret', () => {
  const resources = Object.values(template().Resources);
  const task = resources.find(
    (resource) =>
      resource.Type === 'AWS::ECS::TaskDefinition' && resource.Properties.Family === 'souvenote-staging-section6',
  );
  assert.equal(task.Properties.Cpu, '512');
  assert.equal(task.Properties.Memory, '1024');
  assert.equal(resources.filter((resource) => resource.Type === 'AWS::SecretsManager::Secret').length, 1);
  assert.equal(resources.filter((resource) => resource.Type === 'AWS::Cognito::UserPool').length, 1);
});

test('can disable only the BFF listener rule for an application rollback', () => {
  const synthesized = template();
  const rule = Object.values(synthesized.Resources).find(
    (resource) => resource.Type === 'AWS::ElasticLoadBalancingV2::ListenerRule',
  );
  assert.equal(rule.Condition, 'BffRoutingEnabledCondition');
  assert.deepEqual(synthesized.Conditions.BffRoutingEnabledCondition, {
    'Fn::Equals': [{ Ref: 'BffRoutingEnabled' }, 'true'],
  });
});
