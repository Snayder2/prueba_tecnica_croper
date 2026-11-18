import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

const DESCRIPTION = `API REST para gestionar productos (NestJS + MongoDB).

**Cómo probarla desde aquí**
1. \`POST /auth/register\`: crea un usuario.
2. \`POST /auth/login\`: copia el \`accessToken\` de la respuesta.
3. Pulsa **Authorize**, pega el token y prueba los endpoints de \`Products\`.

Todos los errores usan el mismo formato (\`ErrorResponseDto\`).`;

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API de Productos')
    .setDescription(DESCRIPTION)
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token obtenido en POST /auth/login',
    })
    .addTag('Auth', 'Registro, inicio de sesión y usuario actual')
    .addTag('Products', 'CRUD de productos (requiere JWT)')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, createSwaggerDocument(app), {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    customSiteTitle: 'API de Productos',
    swaggerOptions: { persistAuthorization: true },
  });
}
