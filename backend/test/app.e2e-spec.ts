/**
 * End-to-end checks of the acceptance criteria in docs/specs/01-backend.md §11
 * and docs/specs/03-mejoras-roles-vendedor-comprador.md §17 (contract 1.1.0).
 * Requires a local MongoDB; uses the productos_db_e2e database.
 */
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { calculateFinalPrice } from '../src/modules/products/pricing.js';

const user = { email: 'Ana@Correo.com', password: 'Clave1234', name: 'Ana Pérez', role: 'seller' };
const MISSING_ID = '6739f3b2c4e5b8a9d0f12346';

/** Collects a binary response body (the image endpoint answers image/webp). */
const binaryParser = (
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
) => {
  // In Node, superagent hands the parser the raw response stream.
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
};

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  /** Ana (seller), obtained through the real login. */
  let token: string;
  /** Bruno (another seller) and Carla (buyer), signed directly to avoid the login limit. */
  let otherSellerToken: string;
  let buyerToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
  const auth = () => bearer(token);

  /** Registers a user through the API and returns a valid token for it. */
  async function registerWithToken(email: string, name: string, role: 'seller' | 'buyer') {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email, name, role, password: 'Clave1234' })
      .expect(201);
    return app.get(JwtService).signAsync({ sub: res.body._id, email, role });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { corsOrigin: 'http://localhost:5173' });
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
      expect(res.body).toMatchObject({ email: 'ana@correo.com', name: 'Ana Pérez', role: 'seller' });
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
        .send({ email: 'otro@correo.com', password: 'solo-letras', name: 'Otro', role: 'buyer' })
        .expect(400);
      expect(res.body.message).toContain('password must contain at least one letter and one number');
    });

    it('register without role or with an unknown role returns 400', async () => {
      const base = { email: 'rol@correo.com', password: 'Clave1234', name: 'Sin Rol' };
      const roleMessage = 'role must be one of the following values: seller, buyer';

      const missing = await api().post('/api/v1/auth/register').send(base).expect(400);
      expect(missing.body.message).toContain(roleMessage);

      const unknown = await api()
        .post('/api/v1/auth/register')
        .send({ ...base, role: 'admin' })
        .expect(400);
      expect(unknown.body.message).toContain(roleMessage);
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

    it('GET /auth/me returns the user with its role and without password', async () => {
      const res = await api().get('/api/v1/auth/me').set(auth()).expect(200);
      expect(res.body.email).toBe('ana@correo.com');
      expect(res.body.role).toBe('seller');
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

    it('creates the other seller and the buyer used by the next tests', async () => {
      otherSellerToken = await registerWithToken('bruno@correo.com', 'Bruno Díaz', 'seller');
      buyerToken = await registerWithToken('carla@correo.com', 'Carla Ruiz', 'buyer');
    });
  });

  describe('Seller products', () => {
    const product = {
      name: '  Fertilizante NPK 15-15-15 50 kg  ',
      price: 145000,
      stock: 40,
      category: 'Fertilizantes',
      sku: 'FER-NPK-50',
    };
    let productId: string;

    it('every seller endpoint without token returns 401', async () => {
      const responses = await Promise.all([
        api().get('/api/v1/seller/products'),
        api().get(`/api/v1/seller/products/${MISSING_ID}`),
        api().post('/api/v1/seller/products').send(product),
        api().patch(`/api/v1/seller/products/${MISSING_ID}`).send({ name: 'Otro' }),
        api().delete(`/api/v1/seller/products/${MISSING_ID}`),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' });
      }
    });

    it('a buyer gets 403 "Forbidden" on every seller endpoint', async () => {
      const buyer = bearer(buyerToken);
      const responses = await Promise.all([
        api().get('/api/v1/seller/products').set(buyer),
        api().get(`/api/v1/seller/products/${MISSING_ID}`).set(buyer),
        api().post('/api/v1/seller/products').set(buyer).send(product),
        api().patch(`/api/v1/seller/products/${MISSING_ID}`).set(buyer).send({ name: 'Otro' }),
        api().delete(`/api/v1/seller/products/${MISSING_ID}`).set(buyer),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ statusCode: 403, error: 'Forbidden', message: 'Forbidden' });
      }
    });

    it('POST with valid data returns 201 with the full product and its seller', async () => {
      const res = await api().post('/api/v1/seller/products').set(auth()).send(product).expect(201);
      expect(res.body).toMatchObject({
        name: 'Fertilizante NPK 15-15-15 50 kg',
        price: 145000,
        stock: 40,
        sku: 'FER-NPK-50',
        isActive: true,
        discountPercent: 0,
        finalPrice: 145000,
        images: [],
        seller: { name: 'Ana Pérez' },
      });
      expect(res.body.seller._id).toMatch(/^[a-f\d]{24}$/);
      expect(res.body.seller).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('sellerId');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).not.toHaveProperty('__v');
      productId = res.body._id;
    });

    it('sending sellerId (or any computed field) on create or edit returns 400', async () => {
      const create = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ ...product, sku: 'NEW-SKU', sellerId: MISSING_ID, finalPrice: 1, images: [] })
        .expect(400);
      expect(create.body.message).toEqual(
        expect.arrayContaining([
          'property sellerId should not exist',
          'property finalPrice should not exist',
          'property images should not exist',
        ]),
      );

      const edit = await api()
        .patch(`/api/v1/seller/products/${productId}`)
        .set(auth())
        .send({ sellerId: MISSING_ID, discountPercent: 10 })
        .expect(400);
      expect(edit.body.message).toEqual(
        expect.arrayContaining([
          'property sellerId should not exist',
          'property discountPercent should not exist',
        ]),
      );
    });

    it('POST with negative price, empty name or decimal stock returns 400 with clear messages', async () => {
      const res = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ ...product, sku: 'NEW-SKU', name: '', price: -1, stock: 1.5 })
        .expect(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/api/v1/seller/products',
      });
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
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ ...product, sku: 'NEW-SKU', foo: 'bar' })
        .expect(400);
      expect(res.body.message).toContain('property foo should not exist');
    });

    it('Mongo operator injection in the body is rejected with 400', async () => {
      await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ ...product, sku: { $gt: '' } })
        .expect(400);
    });

    it('the same seller cannot repeat a sku (409), another seller can', async () => {
      const res = await api().post('/api/v1/seller/products').set(auth()).send(product).expect(409);
      expect(res.body.message).toBe('SKU already exists');

      const other = await api()
        .post('/api/v1/seller/products')
        .set(bearer(otherSellerToken))
        .send({ ...product, name: 'Fertilizante de Bruno', isActive: false })
        .expect(201);
      expect(other.body.seller.name).toBe('Bruno Díaz');
    });

    it('GET /seller/products?page=2&limit=5 returns 5 items and a correct meta', async () => {
      for (let i = 1; i <= 11; i++) {
        await api()
          .post('/api/v1/seller/products')
          .set(auth())
          .send({ name: `Producto ${i}`, price: i * 100, stock: i, sku: `PROD-${i}` })
          .expect(201);
      }
      const res = await api().get('/api/v1/seller/products?page=2&limit=5').set(auth()).expect(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    });

    it("GET /seller/products returns only the seller's products, hidden ones included", async () => {
      const res = await api().get('/api/v1/seller/products?limit=100').set(bearer(otherSellerToken)).expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({ name: 'Fertilizante de Bruno', isActive: false });
    });

    it('a page beyond totalPages returns an empty data array, not an error', async () => {
      const res = await api().get('/api/v1/seller/products?page=99&limit=5').set(auth()).expect(200);
      expect(res.body).toEqual({ data: [], meta: { page: 99, limit: 5, total: 12, totalPages: 3 } });
    });

    it('sorts by price ascending', async () => {
      const res = await api()
        .get('/api/v1/seller/products?sortBy=price&order=asc&limit=3')
        .set(auth())
        .expect(200);
      expect(res.body.data.map((p: { price: number }) => p.price)).toEqual([100, 200, 300]);
    });

    it('invalid query params return 400', async () => {
      const res = await api()
        .get('/api/v1/seller/products?limit=101&sortBy=sku')
        .set(auth())
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'limit must not be greater than 100',
          'sortBy must be one of the following values: name, price, finalPrice, stock, createdAt',
        ]),
      );
    });

    it('GET /seller/products/abc returns 400 "Invalid id"', async () => {
      const res = await api().get('/api/v1/seller/products/abc').set(auth()).expect(400);
      expect(res.body.message).toBe('Invalid id');
    });

    it('GET /seller/products/<valid missing id> returns 404', async () => {
      const res = await api().get(`/api/v1/seller/products/${MISSING_ID}`).set(auth()).expect(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('GET /seller/products/:id returns the product', async () => {
      const res = await api().get(`/api/v1/seller/products/${productId}`).set(auth()).expect(200);
      expect(res.body._id).toBe(productId);
    });

    it("another seller gets 404 when reading, editing or deleting the product", async () => {
      const other = bearer(otherSellerToken);
      const responses = await Promise.all([
        api().get(`/api/v1/seller/products/${productId}`).set(other),
        api().patch(`/api/v1/seller/products/${productId}`).set(other).send({ name: 'Robado' }),
        api().delete(`/api/v1/seller/products/${productId}`).set(other),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Product not found');
      }
      await api().get(`/api/v1/seller/products/${productId}`).set(auth()).expect(200);
    });

    it('PATCH updates only the fields sent', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${productId}`)
        .set(auth())
        .send({ price: 30000, description: 'Bulto de 50 kg' })
        .expect(200);
      expect(res.body).toMatchObject({
        price: 30000,
        finalPrice: 30000,
        description: 'Bulto de 50 kg',
        stock: 40,
        name: 'Fertilizante NPK 15-15-15 50 kg',
        sku: 'FER-NPK-50',
        category: 'Fertilizantes',
      });
    });

    it('PATCH with null clears an optional field', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${productId}`)
        .set(auth())
        .send({ description: null })
        .expect(200);
      expect(res.body).not.toHaveProperty('description');
    });

    it('PATCH to an existing sku of the same seller returns 409', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${productId}`)
        .set(auth())
        .send({ sku: 'PROD-1' })
        .expect(409);
      expect(res.body.message).toBe('SKU already exists');
    });

    it('PATCH with null on a required field returns 400', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${productId}`)
        .set(auth())
        .send({ name: null })
        .expect(400);
      expect(res.body.message).toEqual(['name should not be null']);
    });

    it('DELETE returns 204 and a second DELETE returns 404', async () => {
      const first = await api().delete(`/api/v1/seller/products/${productId}`).set(auth()).expect(204);
      expect(first.body).toEqual({});
      await api().delete(`/api/v1/seller/products/${productId}`).set(auth()).expect(404);
    });
  });

  describe('Catalog', () => {
    let hiddenId: string;

    it('every catalog endpoint without token returns 401; an invalid token too', async () => {
      await api().get('/api/v1/products').expect(401);
      await api().get(`/api/v1/products/${MISSING_ID}`).expect(401);
      await api().get('/api/v1/products').set(bearer('not.a.valid.token')).expect(401);
    });

    it('lists only active products of every seller, for buyers and sellers', async () => {
      const asBuyer = await api().get('/api/v1/products?limit=48').set(bearer(buyerToken)).expect(200);
      // 11 active products of Ana; Bruno's only product is hidden.
      expect(asBuyer.body.meta).toEqual({ page: 1, limit: 48, total: 11, totalPages: 1 });
      expect(asBuyer.body.data.every((p: { isActive: boolean }) => p.isActive)).toBe(true);

      await api().get('/api/v1/products').set(auth()).expect(200);
    });

    it('includes seller.name and never the seller email', async () => {
      const res = await api().get('/api/v1/products?limit=1').set(bearer(buyerToken)).expect(200);
      const [first] = res.body.data;
      expect(first.seller).toEqual({ _id: expect.stringMatching(/^[a-f\d]{24}$/), name: 'Ana Pérez' });
      expect(JSON.stringify(res.body)).not.toContain('@correo.com');
      expect(first).not.toHaveProperty('sellerId');
    });

    it('a hidden product answers 404 in the catalog detail', async () => {
      const own = await api().get('/api/v1/seller/products').set(bearer(otherSellerToken)).expect(200);
      hiddenId = own.body.data[0]._id;
      const res = await api().get(`/api/v1/products/${hiddenId}`).set(bearer(buyerToken)).expect(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('GET /products/:id returns an active product, and 400 for an invalid id', async () => {
      const list = await api().get('/api/v1/products?limit=1').set(bearer(buyerToken)).expect(200);
      const id = list.body.data[0]._id;
      const res = await api().get(`/api/v1/products/${id}`).set(bearer(buyerToken)).expect(200);
      expect(res.body._id).toBe(id);

      const invalid = await api().get('/api/v1/products/abc').set(bearer(buyerToken)).expect(400);
      expect(invalid.body.message).toBe('Invalid id');
    });

    it('GET /products?search=cafe finds "Café" and "CAFETERA" (case and accent insensitive)', async () => {
      await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'Café de origen Huila', price: 32000, stock: 10, sku: 'CAF-HUI-500' })
        .expect(201);
      await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'CAFETERA italiana', price: 90000, stock: 5, sku: 'CAF-ITA-01' })
        .expect(201);

      const res = await api().get('/api/v1/products?search=cafe').set(bearer(buyerToken)).expect(200);
      const names = res.body.data.map((p: { name: string }) => p.name).sort();
      expect(names).toEqual(['CAFETERA italiana', 'Café de origen Huila']);
      expect(res.body.meta.total).toBe(2);
    });

    it('search input is treated as text, not as a regex', async () => {
      const res = await api().get('/api/v1/products?search=.*').set(bearer(buyerToken)).expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('limit above 48 returns 400', async () => {
      const res = await api().get('/api/v1/products?limit=49').set(bearer(buyerToken)).expect(400);
      expect(res.body.message).toContain('limit must not be greater than 48');
    });

    describe('filters', () => {
      const catalog = (query: string) =>
        api().get(`/api/v1/products?${query}`).set(bearer(buyerToken)).expect(200);

      it('creates products with categories and one out of stock', async () => {
        await api()
          .post('/api/v1/seller/products')
          .set(auth())
          .send({ name: 'Café molido', price: 20000, stock: 0, category: 'Café', sku: 'CAF-MOL-250' })
          .expect(201);
        await api()
          .post('/api/v1/seller/products')
          .set(auth())
          .send({ name: 'Abono orgánico', price: 45000, stock: 8, category: 'Abonos', sku: 'ABO-ORG-25' })
          .expect(201);
      });

      it('GET /products/categories is not taken as an :id and lists active categories sorted', async () => {
        const res = await api().get('/api/v1/products/categories').set(bearer(buyerToken)).expect(200);
        // "Fertilizantes" only exists in Bruno's hidden product, so it is not listed.
        expect(res.body).toEqual(['Abonos', 'Café']);
      });

      it('category is an exact match', async () => {
        const exact = await catalog('category=Caf%C3%A9');
        expect(exact.body.data.map((p: { name: string }) => p.name)).toEqual(['Café molido']);
        expect((await catalog('category=caf%C3%A9')).body.meta.total).toBe(0);
      });

      it('minPrice and maxPrice filter by finalPrice', async () => {
        const res = await catalog('minPrice=20000&maxPrice=40000&sortBy=finalPrice&order=asc');
        expect(res.body.data.map((p: { finalPrice: number }) => p.finalPrice)).toEqual([20000, 32000]);
      });

      it('minPrice greater than maxPrice returns 400', async () => {
        const res = await api()
          .get('/api/v1/products?minPrice=50000&maxPrice=40000')
          .set(bearer(buyerToken))
          .expect(400);
        expect(res.body.message).toEqual(['minPrice must not be greater than maxPrice']);
      });

      it('onSale=false does not filter (it is not read as true)', async () => {
        const all = await catalog('limit=48');
        const notOnSale = await catalog('limit=48&onSale=false');
        expect(notOnSale.body.meta.total).toBe(all.body.meta.total);
        expect(all.body.meta.total).toBe(15);
        // No product has a discount yet.
        expect((await catalog('onSale=true')).body.meta.total).toBe(0);
      });

      it('inStock=true hides products without stock; inStock=false does not', async () => {
        const inStock = await catalog('limit=48&inStock=true');
        expect(inStock.body.meta.total).toBe(14);
        expect(inStock.body.data.some((p: { name: string }) => p.name === 'Café molido')).toBe(false);
        expect((await catalog('limit=48&inStock=false')).body.meta.total).toBe(15);
      });
    });
  });

  describe('Stock adjustments', () => {
    let id: string;
    const adjust = (body: object, as = token) =>
      api().post(`/api/v1/seller/products/${id}/stock-adjustments`).set(bearer(as)).send(body);

    it('creates a product with an initial stock of 40', async () => {
      const res = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'Semilla de maíz 20 kg', price: 98000, stock: 40, sku: 'SEM-MAI-20' })
        .expect(201);
      id = res.body._id;
    });

    it('PATCH with stock returns 400 "property stock should not exist"', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${id}`)
        .set(auth())
        .send({ stock: 95 })
        .expect(400);
      expect(res.body.message).toEqual(['property stock should not exist']);
    });

    it('an increase and a decrease return the product with the new stock', async () => {
      expect((await adjust({ type: 'increase', quantity: 5 }).expect(200)).body.stock).toBe(45);
      expect((await adjust({ type: 'decrease', quantity: 3 }).expect(200)).body.stock).toBe(42);
    });

    it('a decrease above the current stock returns 409 and changes nothing', async () => {
      const res = await adjust({ type: 'decrease', quantity: 43 }).expect(409);
      expect(res.body.message).toBe('Insufficient stock');
      const product = await api().get(`/api/v1/seller/products/${id}`).set(auth()).expect(200);
      expect(product.body.stock).toBe(42);
    });

    it('validates type and quantity (1 to 100 000)', async () => {
      const res = await adjust({ type: 'remove', quantity: 0 }).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'type must be one of the following values: increase, decrease',
          'quantity must not be less than 1',
        ]),
      );
      const tooMany = await adjust({ type: 'increase', quantity: 100_001 }).expect(400);
      expect(tooMany.body.message).toContain('quantity must not be greater than 100000');
      await adjust({ type: 'increase', quantity: 1.5 }).expect(400);
    });

    it("another seller gets 404 and a buyer 403", async () => {
      const notOwn = await adjust({ type: 'increase', quantity: 1 }, otherSellerToken).expect(404);
      expect(notOwn.body.message).toBe('Product not found');
      await adjust({ type: 'increase', quantity: 1 }, buyerToken).expect(403);
    });

    it('ten simultaneous decreases of 1 over a stock of 5 leave it at 0, never negative', async () => {
      const created = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'Guantes de jardín', price: 15000, stock: 5, sku: 'GUA-JAR-01' })
        .expect(201);
      id = created.body._id;

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => adjust({ type: 'decrease', quantity: 1 })),
      );

      const statuses = responses.map((res) => res.status).sort((a, b) => a - b);
      expect(statuses).toEqual([200, 200, 200, 200, 200, 409, 409, 409, 409, 409]);
      const product = await api().get(`/api/v1/seller/products/${id}`).set(auth()).expect(200);
      expect(product.body.stock).toBe(0);
    });
  });

  describe('Discounts', () => {
    let id: string;
    const discount = (method: 'put' | 'delete', body?: object, as = token) =>
      api()[method](`/api/v1/seller/products/${id}/discount`).set(bearer(as)).send(body);

    it('applying 15 % to 145 000 returns finalPrice 123 250', async () => {
      const created = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'Fertilizante NPK 15-15-15 50 kg', price: 145000, stock: 40, sku: 'FER-NPK-50' })
        .expect(201);
      id = created.body._id;

      const res = await discount('put', { percent: 15 }).expect(200);
      expect(res.body).toMatchObject({ price: 145000, discountPercent: 15, finalPrice: 123250 });
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.body.updatedAt).getTime(),
      );
    });

    it('a discount of 0, 91 or a decimal returns 400', async () => {
      for (const percent of [0, 91, 15.5]) {
        await discount('put', { percent }).expect(400);
      }
      const res = await discount('put', { percent: 91 }).expect(400);
      expect(res.body.message).toEqual(['percent must not be greater than 90']);
    });

    it('changing the price of a discounted product recalculates finalPrice', async () => {
      await discount('put', { percent: 10 }).expect(200);
      const res = await api()
        .patch(`/api/v1/seller/products/${id}`)
        .set(auth())
        .send({ price: 30000, isActive: false })
        .expect(200);
      expect(res.body).toMatchObject({ price: 30000, discountPercent: 10, finalPrice: 27000, isActive: false });
    });

    it('editing other fields keeps the discount and stores text literally', async () => {
      const res = await api()
        .patch(`/api/v1/seller/products/${id}`)
        .set(auth())
        .send({ name: '$price', isActive: true })
        .expect(200);
      expect(res.body).toMatchObject({ name: '$price', price: 30000, finalPrice: 27000 });
    });

    it('the catalog onSale=true filter now finds the discounted product', async () => {
      const res = await api().get('/api/v1/products?onSale=true').set(bearer(buyerToken)).expect(200);
      expect(res.body.data.map((p: { _id: string }) => p._id)).toEqual([id]);
    });

    it('removing the discount leaves discountPercent 0 and finalPrice = price, and is idempotent', async () => {
      const res = await discount('delete').expect(200);
      expect(res.body).toMatchObject({ discountPercent: 0, finalPrice: 30000 });
      await discount('delete').expect(200);
    });

    it('another seller gets 404 and a buyer 403', async () => {
      await discount('put', { percent: 10 }, otherSellerToken).expect(404);
      await discount('delete', undefined, otherSellerToken).expect(404);
      await discount('put', { percent: 10 }, buyerToken).expect(403);
    });

    it('MongoDB computes exactly the same finalPrice as calculateFinalPrice', async () => {
      const cases: [number, number][] = [
        [0.05, 30],
        [0.01, 50],
        [10.05, 50],
        [99999.99, 33],
        [1234.57, 17],
        [19.99, 90],
      ];
      for (const [index, [price, percent]] of cases.entries()) {
        const created = await api()
          .post('/api/v1/seller/products')
          .set(auth())
          .send({ name: `Precio raro ${index}`, price, stock: 1, sku: `RARO-${index}`, isActive: false })
          .expect(201);
        id = created.body._id;
        const res = await discount('put', { percent }).expect(200);
        expect(res.body.finalPrice).toBe(calculateFinalPrice(price, percent));
      }
    });
  });

  describe('Roles', () => {
    it('a buyer gets 403 "Forbidden" on every one of the 11 seller endpoints', async () => {
      const buyer = bearer(buyerToken);
      const base = `/api/v1/seller/products/${MISSING_ID}`;
      const responses = await Promise.all([
        api().get('/api/v1/seller/products').set(buyer),
        api().get(base).set(buyer),
        api().post('/api/v1/seller/products').set(buyer).send({}),
        api().patch(base).set(buyer).send({}),
        api().delete(base).set(buyer),
        api().post(`${base}/stock-adjustments`).set(buyer).send({ type: 'increase', quantity: 1 }),
        api().put(`${base}/discount`).set(buyer).send({ percent: 10 }),
        api().delete(`${base}/discount`).set(buyer),
        api().post(`${base}/images`).set(buyer),
        api().delete(`${base}/images/${MISSING_ID}`).set(buyer),
        api().put(`${base}/images/order`).set(buyer).send({ imageIds: [] }),
      ]);
      expect(responses.map((res) => res.status)).toEqual(Array(11).fill(403));
      for (const res of responses) {
        expect(res.body).toMatchObject({ statusCode: 403, error: 'Forbidden', message: 'Forbidden' });
      }
    });

    it('a buyer can read the catalog and its categories', async () => {
      await api().get('/api/v1/products').set(bearer(buyerToken)).expect(200);
      await api().get('/api/v1/products/categories').set(bearer(buyerToken)).expect(200);
    });
  });

  describe('Images', () => {
    // Every request to the upload route counts towards its limit of 20 per
    // minute (per user and per IP). This block makes 15 before the limit test.
    let id: string;
    const imagesPath = () => `/api/v1/seller/products/${id}/images`;
    const upload = (as = token) => api().post(imagesPath()).set(bearer(as));
    /** GET of a public image URL, without token, as the frontend <img> does. */
    const fetchImage = (url: string) =>
      api().get(new URL(url).pathname).set('Origin', 'http://localhost:5173');
    const imageBytes = async (url: string) =>
      (await fetchImage(url).buffer(true).parse(binaryParser).expect(200)).body as Buffer;
    /** The product as stored in MongoDB, base64 included. */
    const storedProduct = () =>
      app
        .get<Connection>(getConnectionToken())
        .collection<{ images: { _id: Types.ObjectId; data: string; thumbData: string }[] }>('products')
        .findOne({ _id: new Types.ObjectId(id) });

    const solid = (format: 'jpeg' | 'png', width = 64, height = 64) =>
      sharp({ create: { width, height, channels: 3, background: '#00c853' } })
        .toFormat(format)
        .toBuffer();
    /** Random noise barely compresses: 1195 × 1195 gives a JPEG of about 910 KB. */
    const noiseJpeg = (side: number) =>
      sharp(randomBytes(side * side * 3), { raw: { width: side, height: side, channels: 3 } })
        .jpeg({ quality: 80 })
        .toBuffer();
    const jpeg = { filename: 'cafe.jpg', contentType: 'image/jpeg' };

    it('creates the product that receives the images', async () => {
      const res = await api()
        .post('/api/v1/seller/products')
        .set(auth())
        .send({ name: 'Café para fotos', price: 25000, stock: 3, sku: 'CAF-FOT-01', category: 'Café' })
        .expect(201);
      id = res.body._id;
    });

    it('without token or as a buyer the request is rejected before Multer reads the file', async () => {
      // A declared text/plain file: if Multer had read it, its fileFilter would
      // answer 415. A small body avoids the socket reset of an unread upload.
      const text = { filename: 'notas.txt', contentType: 'text/plain' };
      const anonymous = await api().post(imagesPath()).attach('image', Buffer.from('hola'), text);
      expect(anonymous.status).toBe(401);
      const buyer = await upload(buyerToken).attach('image', Buffer.from('hola'), text);
      expect(buyer.status).toBe(403);
      expect(buyer.body.message).toBe('Forbidden');
    });

    it('a JPEG of ~900 KB returns 201 with absolute url and thumbUrl that load cross-origin', async () => {
      const photo = await noiseJpeg(1195);
      expect(photo.length).toBeGreaterThan(900_000);
      expect(photo.length).toBeLessThan(1_048_576);

      const res = await upload().attach('image', photo, jpeg).expect(201);

      expect(res.body.images).toHaveLength(1);
      const [image] = res.body.images;
      const imageUrl = `http://localhost:3000/api/v1/products/${id}/images/${image._id}`;
      // Only the public fields: never the base64 data or the MIME type.
      expect(image).toEqual({
        _id: expect.stringMatching(/^[a-f\d]{24}$/),
        url: imageUrl,
        thumbUrl: `${imageUrl}/thumb`,
        width: 1195,
        height: 1195,
      });

      // Public endpoint: no token, WebP, cacheable forever and usable cross-origin.
      for (const url of [image.url, image.thumbUrl]) {
        const file = await fetchImage(url).buffer(true).parse(binaryParser).expect(200);
        expect(file.headers['content-type']).toBe('image/webp');
        expect(file.headers['cache-control']).toBe('public, max-age=31536000, immutable');
        expect(file.headers['x-content-type-options']).toBe('nosniff');
        // helmet's default (same-origin) would block the image on localhost:5173.
        expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
        expect(Number(file.headers['content-length'])).toBe((file.body as Buffer).length);
      }
      const thumb = await sharp(await imageBytes(image.thumbUrl)).metadata();
      expect(thumb).toMatchObject({ format: 'webp', width: 400, height: 400 });
    });

    it('stores both versions in base64 inside the product document', async () => {
      const product = await storedProduct();
      const [image] = product?.images ?? [];
      expect(typeof image.data).toBe('string');
      const large = await sharp(Buffer.from(image.data, 'base64')).metadata();
      const thumb = await sharp(Buffer.from(image.thumbData, 'base64')).metadata();
      expect(large).toMatchObject({ format: 'webp', width: 1195, height: 1195 });
      expect(thumb).toMatchObject({ format: 'webp', width: 400, height: 400 });
    });

    it('lists and details never return the base64 of the images', async () => {
      const responses = await Promise.all([
        api().get('/api/v1/seller/products').set(auth()),
        api().get(`/api/v1/seller/products/${id}`).set(auth()),
        api().get('/api/v1/products').set(auth()),
        api().get(`/api/v1/products/${id}`).set(auth()),
        api().post(`/api/v1/seller/products/${id}/stock-adjustments`).set(auth()).send({ type: 'increase', quantity: 1 }),
        api().put(`/api/v1/seller/products/${id}/discount`).set(auth()).send({ percent: 10 }),
        api().patch(`/api/v1/seller/products/${id}`).set(auth()).send({ price: 26000 }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(200);
        const products = Array.isArray(res.body.data) ? res.body.data : [res.body];
        const images = products.flatMap((product: { images: object[] }) => product.images);
        expect(images.length).toBeGreaterThan(0);
        for (const image of images) {
          expect(Object.keys(image).sort()).toEqual(['_id', 'height', 'thumbUrl', 'url', 'width']);
        }
        // One image weighs hundreds of KB in base64; the responses stay small.
        expect(JSON.stringify(res.body).length).toBeLessThan(50_000);
      }
    });

    it('the image endpoint only serves active products: a hidden one answers 404', async () => {
      const [image] = (await api().get(`/api/v1/seller/products/${id}`).set(auth())).body.images;
      const hide = (isActive: boolean) =>
        api().patch(`/api/v1/seller/products/${id}`).set(auth()).send({ isActive }).expect(200);

      await hide(false);
      for (const url of [image.url, image.thumbUrl]) {
        const res = await fetchImage(url).expect(404);
        expect(res.body).toMatchObject({ statusCode: 404, message: 'Image not found' });
      }
      await hide(true);
      await fetchImage(image.url).expect(200);
    });

    it('stored images are WebP and keep no EXIF metadata', async () => {
      const withExif = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#4a9e12' } })
        .jpeg()
        .withExif({ IFD0: { Make: 'Camara', Copyright: 'Privado' } })
        .toBuffer();
      expect((await sharp(withExif).metadata()).exif).toBeDefined();

      const res = await upload().attach('image', withExif, jpeg).expect(201);

      const stored = res.body.images[1];
      expect(stored).toMatchObject({ width: 1200, height: 675 });
      const metadata = await sharp(await imageBytes(stored.url)).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
    });

    it('a file of 1 048 577 bytes returns 413 "File too large"', async () => {
      const res = await upload().attach('image', Buffer.alloc(1_048_577), jpeg).expect(413);
      expect(res.body).toMatchObject({ statusCode: 413, message: 'File too large' });
    });

    it('a .txt renamed to .png returns 415 "Unsupported file type"', async () => {
      const res = await upload()
        .attach('image', Buffer.from('solo texto, no es una imagen'), {
          filename: 'notas.png',
          contentType: 'image/png',
        })
        .expect(415);
      expect(res.body.message).toBe('Unsupported file type');
    });

    it('malformed uploads return 400: no file, another field name, two files', async () => {
      const png = await solid('png');

      const noFile = await upload().expect(400);
      expect(noFile.body.message).toBe('Image is required');

      const otherField = await upload()
        .attach('file', png, { filename: 'a.png', contentType: 'image/png' })
        .expect(400);
      expect(otherField.body.message).toBe('Unexpected file field - file');

      const twoFiles = await upload()
        .attach('image', png, { filename: 'a.png', contentType: 'image/png' })
        .attach('image', png, { filename: 'b.png', contentType: 'image/png' })
        .expect(400);
      expect(twoFiles.body.message).toBe('Too many files');
    });

    it('an image over 40 megapixels returns 400 "Image dimensions too large"', async () => {
      const huge = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: '#ffffff' } })
        .png({ compressionLevel: 9 })
        .toBuffer();
      expect(huge.length).toBeLessThan(1_048_576);

      const res = await upload()
        .attach('image', huge, { filename: 'enorme.png', contentType: 'image/png' })
        .expect(400);
      expect(res.body.message).toBe('Image dimensions too large');
    });

    it("another seller gets 404 when uploading to the product", async () => {
      const res = await upload(otherSellerToken)
        .attach('image', await solid('jpeg'), jpeg)
        .expect(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('two simultaneous uploads for the last slot: one 201 and one 409', async () => {
      await upload().attach('image', await solid('png'), { filename: 'b.png', contentType: 'image/png' }).expect(201);

      const responses = await Promise.all([
        upload().attach('image', await solid('jpeg', 80, 80), jpeg),
        upload().attach('image', await solid('jpeg', 90, 90), jpeg),
      ]);

      expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 409]);
      const product = await api().get(`/api/v1/seller/products/${id}`).set(auth()).expect(200);
      expect(product.body.images).toHaveLength(4);
      expect((await storedProduct())?.images).toHaveLength(4);
    });

    it('the fifth image returns 409 "Image limit reached"', async () => {
      const res = await upload().attach('image', await solid('jpeg'), jpeg).expect(409);
      expect(res.body.message).toBe('Image limit reached');
    });

    it('reorders the images; the first one becomes the main image', async () => {
      const before = (await api().get(`/api/v1/seller/products/${id}`).set(auth())).body.images;
      const ids: string[] = before.map((image: { _id: string }) => image._id).reverse();

      const res = await api()
        .put(`${imagesPath()}/order`)
        .set(auth())
        .send({ imageIds: ids })
        .expect(200);

      expect(res.body.images.map((image: { _id: string }) => image._id)).toEqual(ids);
      // The stored subdocuments moved with their data: each URL still serves its image.
      const stored = await storedProduct();
      expect(stored?.images.map((image) => image._id.toString())).toEqual(ids);
      for (const [index, image] of res.body.images.entries()) {
        const served = await imageBytes(image.url);
        expect(served.toString('base64')).toBe(stored?.images[index].data);
      }
    });

    it('reordering with ids that are not exactly the current ones returns 400', async () => {
      const current = (await api().get(`/api/v1/seller/products/${id}`).set(auth())).body.images;
      const ids: string[] = current.map((image: { _id: string }) => image._id);
      const order = (imageIds: unknown) =>
        api().put(`${imagesPath()}/order`).set(auth()).send({ imageIds });

      const missing = await order(ids.slice(1)).expect(400);
      expect(missing.body.message).toEqual(['imageIds must contain exactly the current image ids']);
      await order([...ids.slice(1), MISSING_ID]).expect(400);
      await order([ids[0], ...ids.slice(0, 3)]).expect(400);
      await order(['abc']).expect(400);
      await order([]).expect(400);

      await api()
        .put(`/api/v1/seller/products/${id}/images/order`)
        .set(bearer(otherSellerToken))
        .send({ imageIds: ids })
        .expect(404);
    });

    it('deletes one image and its data; an unknown image answers 404 "Image not found"', async () => {
      const [first] = (await api().get(`/api/v1/seller/products/${id}`).set(auth())).body.images;

      const res = await api().delete(`${imagesPath()}/${first._id}`).set(auth()).expect(200);

      expect(res.body.images).toHaveLength(3);
      expect((await storedProduct())?.images).toHaveLength(3);
      await fetchImage(first.url).expect(404);
      await fetchImage(first.thumbUrl).expect(404);

      const again = await api().delete(`${imagesPath()}/${first._id}`).set(auth()).expect(404);
      expect(again.body.message).toBe('Image not found');
      await api().delete(`${imagesPath()}/abc`).set(auth()).expect(400);
    });

    it('deleting the product removes its images: their URLs answer 404', async () => {
      const { images } = (await api().get(`/api/v1/seller/products/${id}`).set(auth())).body;
      expect(images).toHaveLength(3);
      await fetchImage(images[0].url).expect(200);

      await api().delete(`/api/v1/seller/products/${id}`).set(auth()).expect(204);

      expect(await storedProduct()).toBeNull();
      for (const image of images) {
        await fetchImage(image.url).expect(404);
        await fetchImage(image.thumbUrl).expect(404);
      }
    });

    it('more than 20 uploads per minute return 429 "Too many requests"', async () => {
      let throttled: request.Response | undefined;
      // 16 requests were made above; the window may also restart in between.
      for (let attempt = 0; attempt < 41 && !throttled; attempt++) {
        const res = await upload();
        if (res.status === 429) throttled = res;
      }
      expect(throttled?.body).toMatchObject({ statusCode: 429, message: 'Too many requests' });
    });
  });

  describe('Public image endpoint', () => {
    it('invalid ids answer 400 and an unknown product or image answers 404', async () => {
      const base = '/api/v1/products';
      const invalid = await api().get(`${base}/abc/images/${MISSING_ID}`).expect(400);
      expect(invalid.body.message).toBe('Invalid id');
      await api().get(`${base}/${MISSING_ID}/images/abc/thumb`).expect(400);

      const unknown = await api().get(`${base}/${MISSING_ID}/images/${MISSING_ID}`).expect(404);
      expect(unknown.body).toMatchObject({ statusCode: 404, message: 'Image not found' });
      await api().get(`${base}/${MISSING_ID}/images/${MISSING_ID}/thumb`).expect(404);
    });

    it('the old static /uploads route no longer exists and the API keeps same-origin', async () => {
      await api().get('/uploads/products/cualquiera.webp').expect(404);

      const apiResponse = await api().get('/api/v1/products').set(auth());
      expect(apiResponse.headers['cross-origin-resource-policy']).toBe('same-origin');
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
