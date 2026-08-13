import {
  BootstraplessSynthesizer,
  CfnCondition,
  CfnOutput,
  CfnParameter,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
} from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const providerEnvironment = [
  'EMAIL_PROVIDER_MODE',
  'FULFILLMENT_PROVIDER_MODE',
  'IMAGE_PROVIDER_MODE',
  'MUSIC_PROVIDER_MODE',
  'NOTIFICATION_PROVIDER_MODE',
  'PAYMENT_PROVIDER_MODE',
  'TEXT_PROVIDER_MODE',
].map((name) => ({ name, value: 'disabled' }));

function environment(name, value) {
  return { name, value };
}

export class SouvenoteStagingReleaseStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const backendRepositoryUri = new CfnParameter(this, 'BackendRepositoryUri', {
      type: 'String',
      allowedPattern: '^[0-9]+\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com\\/[a-z0-9/_-]+$',
    });
    const frontendRepositoryUri = new CfnParameter(this, 'FrontendRepositoryUri', {
      type: 'String',
      allowedPattern: '^[0-9]+\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com\\/[a-z0-9/_-]+$',
    });
    const releaseTag = new CfnParameter(this, 'ReleaseTag', {
      type: 'String',
      allowedPattern: '^section6-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$',
    });
    const publicOrigin = new CfnParameter(this, 'PublicOrigin', {
      type: 'String',
      allowedPattern: '^https:\\/\\/[a-z0-9.-]+$',
    });
    const databaseHost = new CfnParameter(this, 'DatabaseHost', {
      type: 'String',
      allowedPattern: '^[A-Za-z0-9.-]+$',
    });
    const databaseSecretArn = new CfnParameter(this, 'DatabaseSecretArn', {
      type: 'String',
      allowedPattern: '^arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:.+$',
      noEcho: true,
    });
    const existingListenerArn = new CfnParameter(this, 'ExistingListenerArn', {
      type: 'String',
      allowedPattern: '^arn:aws:elasticloadbalancing:[a-z0-9-]+:[0-9]{12}:listener\\/.+$',
    });
    const existingFrontendTargetGroupArn = new CfnParameter(this, 'ExistingFrontendTargetGroupArn', {
      type: 'String',
      allowedPattern: '^arn:aws:elasticloadbalancing:[a-z0-9-]+:[0-9]{12}:targetgroup\\/.+$',
    });
    const bffRoutingEnabled = new CfnParameter(this, 'BffRoutingEnabled', {
      type: 'String',
      allowedValues: ['true', 'false'],
      default: 'false',
      description:
        'Allows an application rollback to restore the foundation listener behavior without deleting auth data.',
    });
    const bffRoutingCondition = new CfnCondition(this, 'BffRoutingEnabledCondition', {
      expression: Fn.conditionEquals(bffRoutingEnabled.valueAsString, 'true'),
    });

    const bffSessionSecret = new secretsmanager.Secret(this, 'BffSessionSecret', {
      description: 'Encrypted session-cookie key for the Section 6 staging BFF.',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const tokenRole = new iam.Role(this, 'TokenClaimsRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Writes no customer data; permits only bounded pre-token Lambda logs.',
    });
    tokenRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/lambda/souvenote-staging-token-claims:*`,
        ],
      }),
    );
    const tokenLogGroup = new logs.LogGroup(this, 'TokenClaimsLogGroup', {
      logGroupName: '/aws/lambda/souvenote-staging-token-claims',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const tokenFunction = new lambda.Function(this, 'TokenClaimsFunction', {
      functionName: 'souvenote-staging-token-claims',
      description: 'Copies only a verified Cognito email into customer access tokens; emits no payload logs.',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: Duration.seconds(3),
      memorySize: 128,
      role: tokenRole,
      code: lambda.Code.fromInline(`exports.handler = async (event) => {
  const attributes = event.request && event.request.userAttributes || {};
  if (!attributes.email || attributes.email_verified !== 'true') throw new Error('Verified email required');
  event.response = event.response || {};
  event.response.claimsAndScopeOverrideDetails = {
    accessTokenGeneration: { claimsToAddOrOverride: { email: attributes.email } },
    idTokenGeneration: {}
  };
  return event;
};`),
    });
    tokenFunction.node.addDependency(tokenLogGroup);

    const userPool = new cognito.CfnUserPool(this, 'UserPool', {
      userPoolName: 'souvenote-staging-section6',
      userPoolTier: 'ESSENTIALS',
      usernameAttributes: ['email'],
      autoVerifiedAttributes: ['email'],
      mfaConfiguration: 'OPTIONAL',
      enabledMfas: ['SOFTWARE_TOKEN_MFA'],
      accountRecoverySetting: { recoveryMechanisms: [{ name: 'verified_email', priority: 1 }] },
      adminCreateUserConfig: { allowAdminCreateUserOnly: false },
      policies: {
        passwordPolicy: {
          minimumLength: 12,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          requireUppercase: true,
          temporaryPasswordValidityDays: 7,
        },
      },
      userAttributeUpdateSettings: { attributesRequireVerificationBeforeUpdate: ['email'] },
      lambdaConfig: {
        preTokenGenerationConfig: {
          lambdaArn: tokenFunction.functionArn,
          lambdaVersion: 'V2_0',
        },
      },
      userPoolTags: { Environment: 'staging', ManagedBy: 'CDK', Project: 'Souvenote' },
    });
    tokenFunction.addPermission('CognitoInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: userPool.attrArn,
    });

    const resourceServer = new cognito.CfnUserPoolResourceServer(this, 'CustomerResourceServer', {
      identifier: 'souvenote',
      name: 'Souvenote customer API',
      userPoolId: userPool.ref,
      scopes: [{ scopeName: 'customer', scopeDescription: 'Access the authenticated Souvenote customer API.' }],
    });
    const userPoolDomain = new cognito.CfnUserPoolDomain(this, 'UserPoolDomain', {
      domain: Fn.sub('souvenote-section6-${AWS::AccountId}'),
      userPoolId: userPool.ref,
    });
    const callbackUrl = Fn.join('', [publicOrigin.valueAsString, '/api/auth/callback']);
    const logoutUrl = publicOrigin.valueAsString;
    const userPoolClient = new cognito.CfnUserPoolClient(this, 'UserPoolClient', {
      clientName: 'souvenote-staging-section6-web',
      userPoolId: userPool.ref,
      generateSecret: false,
      preventUserExistenceErrors: 'ENABLED',
      enableTokenRevocation: true,
      explicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['openid', 'email', 'profile', 'souvenote/customer'],
      supportedIdentityProviders: ['COGNITO'],
      callbackUrLs: [callbackUrl],
      logoutUrLs: [logoutUrl],
      accessTokenValidity: 60,
      idTokenValidity: 60,
      refreshTokenValidity: 30,
      tokenValidityUnits: { accessToken: 'minutes', idToken: 'minutes', refreshToken: 'days' },
    });
    userPoolClient.addResourceDependency(resourceServer);
    userPoolClient.addResourceDependency(userPoolDomain);

    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [databaseSecretArn.valueAsString, bffSessionSecret.secretArn],
      }),
    );
    const applicationRole = new iam.Role(this, 'ApplicationTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'No provider or object-storage permissions are granted in Section 6 staging.',
    });

    const backendImage = { 'Fn::Join': ['', [backendRepositoryUri.valueAsString, ':', releaseTag.valueAsString]] };
    const frontendImage = { 'Fn::Join': ['', [frontendRepositoryUri.valueAsString, ':', releaseTag.valueAsString]] };
    const databasePassword = { 'Fn::Join': ['', [databaseSecretArn.valueAsString, ':password::']] };
    const issuer = { 'Fn::Sub': ['https://cognito-idp.${AWS::Region}.amazonaws.com/${Pool}', { Pool: userPool.ref }] };
    const cognitoDomain = {
      'Fn::Sub': ['https://${Domain}.auth.${AWS::Region}.amazoncognito.com', { Domain: userPoolDomain.ref }],
    };
    const baseDatabaseEnvironment = [
      environment('DATABASE_HOST', databaseHost.valueAsString),
      environment('DATABASE_PORT', '5432'),
      environment('DATABASE_NAME', 'souvenote_mvp_staging'),
      environment('DATABASE_USER', 'souvenote_admin'),
      environment('DATABASE_SSL_MODE', 'verify-full'),
      environment('DATABASE_SSL_CA_FILE', '/opt/souvenote/rds-global-bundle.pem'),
    ];

    const taskDefinition = new ecs.CfnTaskDefinition(this, 'ApplicationTaskDefinition', {
      family: 'souvenote-staging-section6',
      requiresCompatibilities: ['FARGATE'],
      networkMode: 'awsvpc',
      cpu: '512',
      memory: '1024',
      executionRoleArn: executionRole.roleArn,
      taskRoleArn: applicationRole.roleArn,
      runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
      containerDefinitions: [
        {
          name: 'frontend',
          essential: true,
          image: frontendImage,
          cpu: 192,
          memoryReservation: 320,
          portMappings: [{ containerPort: 3000, protocol: 'tcp' }],
          dependsOn: [{ containerName: 'backend', condition: 'HEALTHY' }],
          environment: [
            environment('NODE_ENV', 'production'),
            environment('AUTH_MODE', 'cognito'),
            environment('API_INTERNAL_BASE_URL', 'http://127.0.0.1:4000/api/v1'),
            environment('COGNITO_DOMAIN', cognitoDomain),
            environment('COGNITO_ISSUER', issuer),
            environment('COGNITO_CLIENT_ID', userPoolClient.ref),
            environment('COGNITO_REDIRECT_URI', callbackUrl),
            environment('COGNITO_LOGOUT_URI', logoutUrl),
            environment('COGNITO_OAUTH_SCOPES', 'openid email profile souvenote/customer'),
          ],
          secrets: [{ name: 'BFF_SESSION_SECRET', valueFrom: bffSessionSecret.secretArn }],
          healthCheck: {
            command: [
              'CMD-SHELL',
              'node -e "fetch(\'http://127.0.0.1:3000/api/health\').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"',
            ],
            interval: 30,
            retries: 3,
            startPeriod: 60,
            timeout: 5,
          },
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': '/aws/ecs/souvenote/staging/frontend',
              'awslogs-region': this.region,
              'awslogs-stream-prefix': 'section6',
            },
          },
        },
        {
          name: 'backend',
          essential: true,
          image: backendImage,
          cpu: 256,
          memoryReservation: 512,
          portMappings: [{ containerPort: 4000, protocol: 'tcp' }],
          environment: [
            environment('NODE_ENV', 'production'),
            environment('HOST', '0.0.0.0'),
            environment('PORT', '4000'),
            environment('TRUST_PROXY_HOPS', '1'),
            environment('CORS_ALLOWED_ORIGINS', publicOrigin.valueAsString),
            environment('AUTH_MODE', 'cognito'),
            environment('COGNITO_REGION', this.region),
            environment('COGNITO_USER_POOL_ID', userPool.ref),
            environment('COGNITO_CLIENT_ID', userPoolClient.ref),
            environment('COGNITO_REQUIRED_SCOPES', 'souvenote/customer'),
            environment('RELEASE_STAGE', 'invite_only_beta'),
            environment('ASSET_STORAGE_MODE', 'disabled'),
            environment('BLANK_CARD_HANDOFF_ENABLED', 'false'),
            ...baseDatabaseEnvironment,
            ...providerEnvironment,
          ],
          secrets: [{ name: 'DATABASE_PASSWORD', valueFrom: databasePassword }],
          healthCheck: {
            command: [
              'CMD-SHELL',
              'node -e "fetch(\'http://127.0.0.1:4000/api/v1/health/ready\').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"',
            ],
            interval: 30,
            retries: 3,
            startPeriod: 60,
            timeout: 5,
          },
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': '/aws/ecs/souvenote/staging/backend',
              'awslogs-region': this.region,
              'awslogs-stream-prefix': 'section6-api',
            },
          },
        },
        {
          name: 'worker',
          essential: true,
          image: backendImage,
          command: ['node', 'apps/worker/dist/main.js'],
          cpu: 64,
          memoryReservation: 128,
          environment: [
            environment('NODE_ENV', 'production'),
            environment('AUTH_MODE', 'disabled'),
            environment('WORKER_MODE', 'idle'),
            environment('WORKER_HOST', '0.0.0.0'),
            environment('WORKER_PORT', '4001'),
            environment('TRY_RISK_FREE_RESOLVER_ENABLED', 'false'),
            ...baseDatabaseEnvironment,
            ...providerEnvironment,
          ],
          secrets: [{ name: 'DATABASE_PASSWORD', valueFrom: databasePassword }],
          healthCheck: {
            command: [
              'CMD-SHELL',
              'node -e "fetch(\'http://127.0.0.1:4001/health/ready\').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"',
            ],
            interval: 30,
            retries: 3,
            startPeriod: 60,
            timeout: 5,
          },
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': '/aws/ecs/souvenote/staging/backend',
              'awslogs-region': this.region,
              'awslogs-stream-prefix': 'section6-worker',
            },
          },
        },
      ],
      tags: [
        { key: 'Environment', value: 'staging' },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'Project', value: 'Souvenote' },
      ],
    });

    const migrationTaskDefinition = new ecs.CfnTaskDefinition(this, 'MigrationTaskDefinition', {
      family: 'souvenote-staging-section6-migrations',
      requiresCompatibilities: ['FARGATE'],
      networkMode: 'awsvpc',
      cpu: '256',
      memory: '512',
      executionRoleArn: executionRole.roleArn,
      taskRoleArn: applicationRole.roleArn,
      runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
      containerDefinitions: [
        {
          name: 'migration',
          essential: true,
          image: backendImage,
          command: ['node', 'database/migrate.mjs', '--create-database'],
          environment: [environment('NODE_ENV', 'production'), ...baseDatabaseEnvironment],
          secrets: [{ name: 'DATABASE_PASSWORD', valueFrom: databasePassword }],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': '/aws/ecs/souvenote/staging/backend',
              'awslogs-region': this.region,
              'awslogs-stream-prefix': 'section6-migration',
            },
          },
        },
      ],
      tags: [
        { key: 'Environment', value: 'staging' },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'Project', value: 'Souvenote' },
      ],
    });

    const frontendBffListenerRule = new elbv2.CfnListenerRule(this, 'FrontendBffListenerRule', {
      listenerArn: existingListenerArn.valueAsString,
      priority: 5,
      conditions: [
        {
          field: 'path-pattern',
          pathPatternConfig: { values: ['/api/auth/*', '/api/bff/*', '/api/health'] },
        },
      ],
      actions: [{ type: 'forward', targetGroupArn: existingFrontendTargetGroupArn.valueAsString }],
    });
    frontendBffListenerRule.cfnOptions.condition = bffRoutingCondition;

    Tags.of(this).add('Environment', 'staging');
    Tags.of(this).add('ManagedBy', 'CDK');
    Tags.of(this).add('Project', 'Souvenote');

    new CfnOutput(this, 'ApplicationTaskDefinitionArn', { value: taskDefinition.ref });
    new CfnOutput(this, 'MigrationTaskDefinitionArn', { value: migrationTaskDefinition.ref });
    new CfnOutput(this, 'CognitoUserPoolId', { value: userPool.ref });
    new CfnOutput(this, 'CognitoUserPoolClientId', { value: userPoolClient.ref });
    new CfnOutput(this, 'CognitoDomain', { value: cognitoDomain });
    new CfnOutput(this, 'ReleaseTagOutput', { value: releaseTag.valueAsString });
  }
}

export function synthesizeStagingTemplate(app) {
  const stack = new SouvenoteStagingReleaseStack(app, 'TestSouvenoteStagingRelease', {
    env: { region: 'ca-central-1' },
    synthesizer: new BootstraplessSynthesizer(),
  });
  return stack;
}
