import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = '/api/docs';

export function configureSwaggerDocumentation(
  app: INestApplication,
  enabled: boolean,
) {
  if (!enabled) return null;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Souvenote Backend API')
    .setDescription('Backend API for Souvenote MVP')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Cognito ID token',
      },
      'cognito',
    )
    .addSecurityRequirements('cognito')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH.slice(1), app, swaggerDocument);
  return SWAGGER_PATH;
}
