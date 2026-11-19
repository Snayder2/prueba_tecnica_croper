import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

/** Contract version (docs/specs/api-contract.md). Shown as info.version in OpenAPI. */
export const API_VERSION = '1.1.0';

const DESCRIPTION = `API REST de un pequeño marketplace agro (NestJS + MongoDB), contrato 1.1.0.

- **Vendedor (\`seller\`)**: gestiona sus productos en \`Seller products\`: CRUD, stock, descuento e imágenes.
- **Comprador (\`buyer\`)**: consulta el catálogo de todos los vendedores en \`Catalog\`.

**Cómo probarla desde aquí**
1. \`POST /auth/register\` con \`role: "seller"\` o \`"buyer"\` (o usa los usuarios de \`npm run seed\`).
2. \`POST /auth/login\`: copia el \`accessToken\` de la respuesta.
3. Pulsa **Authorize**, pega el token y prueba los endpoints. La subida de imágenes muestra un selector de archivo.

Un comprador recibe 403 en \`/seller/...\`, y un producto de otro vendedor responde 404.
Las imágenes se guardan en MongoDB y se sirven sin token en \`GET /products/:id/images/:imageId\` (y \`/thumb\`).
Todos los errores usan el mismo formato (\`ErrorResponseDto\`).`;

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API de Productos – Vendedores y compradores')
    .setDescription(DESCRIPTION)
    .setVersion(API_VERSION)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token obtenido en POST /auth/login',
    })
    .addTag('Auth', 'Registro, inicio de sesión y usuario actual')
    .addTag('Catalog', 'Catálogo de solo lectura para cualquier usuario autenticado')
    .addTag('Seller products', 'Gestión de los productos propios (solo rol `seller`)')
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
