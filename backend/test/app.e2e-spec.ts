/**
 * End-to-end checks of the acceptance criteria in docs/specs/01-backend.md §11.
 * Requires a local MongoDB; uses the productos_db_e2e database.
 */
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

const user = { email: 'Ana@Correo.com', password: 'Clave1234', name: 'Ana Pérez' };
const MISSING_ID = '6739f3b2c4e5b8a9d0f12346';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();

    const connection = app.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
    await Promise.all(Object.values(connection.models).map((model) => model.syncIndexes()));
  });

  afterAll(async () => {
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    await app.close();
  });

  describe('Auth', () => {
    it('register returns 201 without password and lowercases the email', async () => {
      const res = await api().post('/api/v1/auth/register').send(user).expect(201);
      expect(res.body).toMatchObject({ email: 'ana@correo.com', name: 'Ana Pérez' });
      expect(res.body._id).toMatch(/^[a-f\d]{24}$/);
      expect(res.body).not.toHaveProperty('password');
    });

    it('register with an existing email returns 409', async () => {
      const res = await api().post('/api/v1/auth/register').send(user).expect(409);
      expect(res.body.message).toBe('Email already registered');
    });

    it('register with a weak password returns 400 with field messages', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: 'otro@correo.com', password: 'solo-letras', name: 'Otro' })
        .expect(400);
      expect(res.body.message).toContain('password must contain at least one letter and one number');
    });

    it('login with valid credentials returns accessToken, Bearer and expiresIn in seconds', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
      expect(typeof res.body.accessToken).toBe('string');
      token = res.body.accessToken;
    });

    it('login with a wrong password or unknown email returns the same generic 401', async () => {
      const wrongPassword = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Incorrecta1' })
        .expect(401);
      const unknownEmail = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'nadie@correo.com', password: 'Clave1234' })
        .expect(401);
      expect(wrongPassword.body.message).toBe('Invalid credentials');
      expect(unknownEmail.body.message).toBe('Invalid credentials');
    });

    it('GET /auth/me returns the user without password', async () => {
      const res = await api().get('/api/v1/auth/me').set(auth()).expect(200);
      expect(res.body.email).toBe('ana@correo.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('more than 5 login attempts per minute return 429', async () => {
      // 3 attempts were already made above; the 6th one must be throttled.
      for (let i = 0; i < 2; i++) {
        await api().post('/api/v1/auth/login').send({ email: user.email, password: 'x' });
      }
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(429);
      expect(res.body).toMatchObject({ statusCode: 429, message: 'Too many requests' });
    });
  });

  describe('Products', () => {
    const product = {
      name: '  Fertilizante NPK 15-15-15 50 kg  ',
      price: 145000,
      stock: 40,
      category: 'Fertilizantes',
      sku: 'FER-NPK-50',
    };
    let productId: string;

    it('every product endpoint without token returns 401', async () => {
      const responses = await Promise.all([
        api().get('/api/v1/products'),
        api().get(`/api/v1/products/${MISSING_ID}`),
        api().post('/api/v1/products').send(product),
        api().patch(`/api/v1/products/${MISSING_ID}`).send({ stock: 1 }),
        api().delete(`/api/v1/products/${MISSING_ID}`),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' });
      }
    });

    it('POST with valid data returns 201 with the full product', async () => {
      const res = await api().post('/api/v1/products').set(auth()).send(product).expect(201);
      expect(res.body).toMatchObject({
        name: 'Fertilizante NPK 15-15-15 50 kg',
        price: 145000,
        stock: 40,
        sku: 'FER-NPK-50',
        isActive: true,
      });
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).not.toHaveProperty('__v');
      productId = res.body._id;
    });

    it('POST with negative price, empty name or decimal stock returns 400 with clear messages', async () => {
      const res = await api()
        .post('/api/v1/products')
        .set(auth())
        .send({ ...product, sku: 'NEW-SKU', name: '', price: -1, stock: 1.5 })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', path: '/api/v1/products' });
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'name must be longer than or equal to 3 characters',
          'price must not be less than 0',
          'stock must be an integer number',
        ]),
      );
    });

    it('a field not defined in the DTO returns 400', async () => {
      const res = await api()
        .post('/api/v1/products')
        .set(auth())
        .send({ ...product, sku: 'NEW-SKU', foo: 'bar' })
        .expect(400);
      expect(res.body.message).toContain('property foo should not exist');
    });

    it('Mongo operator injection in the body is rejected with 400', async () => {
      await api()
        .post('/api/v1/products')
        .set(auth())
        .send({ ...product, sku: { $gt: '' } })
        .expect(400);
    });

    it('two products with the same sku return 409', async () => {
      const res = await api().post('/api/v1/products').set(auth()).send(product).expect(409);
      expect(res.body.message).toBe('SKU already exists');
    });

    it('GET /products?page=2&limit=5 returns 5 items and a correct meta', async () => {
      for (let i = 1; i <= 11; i++) {
        await api()
          .post('/api/v1/products')
          .set(auth())
          .send({ name: `Producto ${i}`, price: i * 100, stock: i, sku: `PROD-${i}` })
          .expect(201);
      }
      const res = await api().get('/api/v1/products?page=2&limit=5').set(auth()).expect(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    });

    it('a page beyond totalPages returns an empty data array, not an error', async () => {
      const res = await api().get('/api/v1/products?page=99&limit=5').set(auth()).expect(200);
      expect(res.body).toEqual({ data: [], meta: { page: 99, limit: 5, total: 12, totalPages: 3 } });
    });

    it('sorts by price ascending', async () => {
      const res = await api()
        .get('/api/v1/products?sortBy=price&order=asc&limit=3')
        .set(auth())
        .expect(200);
      expect(res.body.data.map((p: { price: number }) => p.price)).toEqual([100, 200, 300]);
    });

    it('invalid query params return 400', async () => {
      const res = await api().get('/api/v1/products?limit=101&sortBy=sku').set(auth()).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'limit must not be greater than 100',
          'sortBy must be one of the following values: name, price, stock, createdAt',
        ]),
      );
    });

    it('GET /products?search=cafe finds "Café" and "CAFETERA" (case and accent insensitive)', async () => {
      await api()
        .post('/api/v1/products')
        .set(auth())
        .send({ name: 'Café de origen Huila', price: 32000, stock: 10, sku: 'CAF-HUI-500' })
        .expect(201);
      await api()
        .post('/api/v1/products')
        .set(auth())
        .send({ name: 'CAFETERA italiana', price: 90000, stock: 5, sku: 'CAF-ITA-01' })
        .expect(201);

      const res = await api().get('/api/v1/products?search=cafe').set(auth()).expect(200);
      const names = res.body.data.map((p: { name: string }) => p.name).sort();
      expect(names).toEqual(['CAFETERA italiana', 'Café de origen Huila']);
      expect(res.body.meta.total).toBe(2);
    });

    it('search input is treated as text, not as a regex', async () => {
      const res = await api().get('/api/v1/products?search=.*').set(auth()).expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('GET /products/abc returns 400 "Invalid id"', async () => {
      const res = await api().get('/api/v1/products/abc').set(auth()).expect(400);
      expect(res.body.message).toBe('Invalid id');
    });

    it('GET /products/<valid missing id> returns 404', async () => {
      const res = await api().get(`/api/v1/products/${MISSING_ID}`).set(auth()).expect(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('GET /products/:id returns the product', async () => {
      const res = await api().get(`/api/v1/products/${productId}`).set(auth()).expect(200);
      expect(res.body._id).toBe(productId);
    });

    it('PATCH updates only the fields sent', async () => {
      const res = await api()
        .patch(`/api/v1/products/${productId}`)
        .set(auth())
        .send({ price: 30000, stock: 95 })
        .expect(200);
      expect(res.body).toMatchObject({
        price: 30000,
        stock: 95,
        name: 'Fertilizante NPK 15-15-15 50 kg',
        sku: 'FER-NPK-50',
        category: 'Fertilizantes',
      });
    });

    it('PATCH to an existing sku returns 409', async () => {
      const res = await api()
        .patch(`/api/v1/products/${productId}`)
        .set(auth())
        .send({ sku: 'PROD-1' })
        .expect(409);
      expect(res.body.message).toBe('SKU already exists');
    });

    it('PATCH with null on a required field returns 400', async () => {
      const res = await api()
        .patch(`/api/v1/products/${productId}`)
        .set(auth())
        .send({ name: null })
        .expect(400);
      expect(res.body.message).toEqual(['name should not be null']);
    });

    it('DELETE returns 204 and a second DELETE returns 404', async () => {
      const first = await api().delete(`/api/v1/products/${productId}`).set(auth()).expect(204);
      expect(first.body).toEqual({});
      await api().delete(`/api/v1/products/${productId}`).set(auth()).expect(404);
    });

    it('an invalid token returns 401', async () => {
      await api()
        .get('/api/v1/products')
        .set({ Authorization: 'Bearer not.a.valid.token' })
        .expect(401);
    });
  });

  describe('Security headers', () => {
    it('helmet headers are set and CORS only allows the configured origin', async () => {
      const allowed = await api()
        .get('/api/v1/products')
        .set(auth())
        .set('Origin', 'http://localhost:5173');
      expect(allowed.headers['x-content-type-options']).toBe('nosniff');
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

      const other = await api().get('/api/v1/products').set(auth()).set('Origin', 'http://evil.test');
      expect(other.headers['access-control-allow-origin']).not.toBe('http://evil.test');
    });
  });
});
