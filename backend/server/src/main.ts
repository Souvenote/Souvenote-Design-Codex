import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Makes its so the frontend and backend can communicate with each other
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // all endpoints will be prefixed with /api
  app.setGlobalPrefix('api');


  // makes sure that all incoming requests are validated
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Set up Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Souvenote Backend API')
    .setDescription('Backend API for Souvenote MVP')
    .setVersion('0.1.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  // Reads .env variables and starts the server
  const configService = app.get(ConfigService);
  // If PORT is not set in .env, it defaults to 4000
  const port = configService.get<number>('PORT') ?? 4000;

  // start server
  await app.listen(port);

  // prints helpful information to the console when the server starts
  console.log(`Souvenote backend running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
