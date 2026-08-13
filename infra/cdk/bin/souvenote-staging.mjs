#!/usr/bin/env node
import { App, BootstraplessSynthesizer } from 'aws-cdk-lib';
import { SouvenoteStagingReleaseStack } from '../lib/staging-stack.mjs';

const app = new App();
new SouvenoteStagingReleaseStack(app, 'SouvenoteStagingRelease', {
  description: 'Current-workspace Souvenote staging release resources; reuses the approved staging foundation.',
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'ca-central-1' },
  stackName: 'souvenote-staging-release',
  synthesizer: new BootstraplessSynthesizer(),
});
