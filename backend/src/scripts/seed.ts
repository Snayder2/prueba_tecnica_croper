/**
 * Test data (npm run seed, spec 03 §14). Leaves the database always in the
 * same state, so it can run as many times as needed:
 * 1. Empties the users and products collections and syncs their indexes
 *    (this also drops the old global unique index of sku from version 1.0).
 * 2. Creates 2 sellers and 1 buyer, and 30 products from seed/products.json,
 *    some with discount, some out of stock and some hidden. The images in
 *    seed/images go through the same ImageProcessingService as the app and
 *    are stored in base64 inside each product (at most 4 per product).
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AppModule } from '../app.module.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { BCRYPT_ROUNDS } from '../modules/auth/auth.service.js';
import {
  ImageProcessingService,
  PROCESSED_IMAGE_MIME,
} from '../modules/images/image-processing.service.js';
import { productImageUrls } from '../modules/products/image-urls.js';
import { calculateFinalPrice } from '../modules/products/pricing.js';
import type { ProductImageRecord } from '../modules/products/schemas/product-image.schema.js';
import { MAX_PRODUCT_IMAGES, Product } from '../modules/products/schemas/product.schema.js';
import { User, UserRole } from '../modules/users/schemas/user.schema.js';

const SEED_DIR = resolve(import.meta.dirname, '..', '..', 'seed');
const PASSWORD = 'Clave1234';

const USERS: { email: string; name: string; role: UserRole }[] = [
  { email: 'ana.vendedora@correo.com', name: 'Ana Pérez', role: 'seller' },
  { email: 'bruno.vendedor@correo.com', name: 'Bruno Díaz', role: 'seller' },
  { email: 'carla.compradora@correo.com', name: 'Carla Ruiz', role: 'buyer' },
];

/** Discount (%) per SKU. FER-DAP-50 is hidden on purpose. */
const DISCOUNTS: Record<string, number> = {
  'FER-NPK-50': 15,
  'SEM-TOM-1000': 10,
  'AGQ-GLIF-1L': 5,
  'NUT-LECHE-40': 20,
  'HER-MACH-22': 25,
  'RIE-MANG-100': 30,
  'CAF-HUI-500': 10,
  'FER-DAP-50': 12,
};

/** Products with a second image; products without category or packaging get none. */
const WITH_DETAIL_IMAGE = new Set(['FER-NPK-50', 'SEM-MAIZ-20', 'HER-FUMI-20', 'CAF-HUI-500']);
const WITHOUT_IMAGES = new Set(['EMP-FIQUE-70', 'HER-CANA-01', 'SEM-FRI-5']);

interface SeedProduct {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  createdAt: { $date: string };
}

/** "Nutrición animal" → "nutricion-animal" (file name in seed/images). */
const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');

const logger = new Logger('Seed');
// Quiet while Nest starts; the seed summary is printed afterwards.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
Logger.overrideLogger(['log', 'error', 'warn']);

try {
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  const imageProcessing = app.get(ImageProcessingService);
  const publicBaseUrl = app
    .get<ConfigService<EnvironmentVariables, true>>(ConfigService)
    .get('PUBLIC_BASE_URL', { infer: true });

  // 1. Clean state. The images live inside the products, so they go with them.
  await Promise.all([userModel.deleteMany({}), productModel.deleteMany({})]);
  await Promise.all([userModel.syncIndexes(), productModel.syncIndexes()]);

  // 2. Users.
  const password = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const users = await userModel.insertMany(USERS.map((user) => ({ ...user, password })));
  const sellers = users.filter((user) => user.role === 'seller');

  // Each source image is processed once; every product gets its own copy of
  // the base64 inside its document.
  type EncodedImage = Pick<ProductImageRecord, 'data' | 'thumbData' | 'width' | 'height'>;
  const encodedCache = new Map<string, Promise<EncodedImage>>();
  const encodeSource = (name: string) => {
    if (!encodedCache.has(name)) {
      encodedCache.set(
        name,
        readFile(join(SEED_DIR, 'images', `${name}.jpg`))
          .then((buffer) => imageProcessing.process(buffer))
          .then((processed) => ({
            data: processed.large.toString('base64'),
            thumbData: processed.thumbnail.toString('base64'),
            width: processed.width,
            height: processed.height,
          })),
      );
    }
    return encodedCache.get(name) as Promise<EncodedImage>;
  };
  const buildImage = async (productId: Types.ObjectId, name: string): Promise<ProductImageRecord> => {
    const imageId = new Types.ObjectId();
    return {
      _id: imageId,
      mimeType: PROCESSED_IMAGE_MIME,
      ...(await encodeSource(name)),
      ...productImageUrls(publicBaseUrl, productId.toString(), imageId.toString()),
    };
  };

  // 3. Products, alternating between both sellers.
  const seedProducts = JSON.parse(
    await readFile(join(SEED_DIR, 'products.json'), 'utf8'),
  ) as SeedProduct[];

  const products = [];
  for (const [index, item] of seedProducts.entries()) {
    const discountPercent = DISCOUNTS[item.sku] ?? 0;
    const sources =
      WITHOUT_IMAGES.has(item.sku) || !item.category
        ? []
        : [slug(item.category), ...(WITH_DETAIL_IMAGE.has(item.sku) ? ['detalle'] : [])];
    const createdAt = new Date(item.createdAt.$date);
    // The image URLs include the product id, so it is generated here.
    const productId = new Types.ObjectId();

    products.push({
      _id: productId,
      sellerId: sellers[index % sellers.length]._id,
      name: item.name,
      description: item.description,
      price: item.price,
      discountPercent,
      finalPrice: calculateFinalPrice(item.price, discountPercent),
      stock: item.stock,
      category: item.category,
      sku: item.sku,
      isActive: item.isActive,
      images: await Promise.all(
        sources.slice(0, MAX_PRODUCT_IMAGES).map((name) => buildImage(productId, name)),
      ),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await productModel.insertMany(products, { timestamps: false });

  const onSale = products.filter((product) => product.discountPercent > 0).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;
  const hidden = products.filter((product) => !product.isActive).length;
  logger.log(
    `${users.length} users and ${products.length} products created ` +
      `(${onSale} on sale, ${outOfStock} out of stock, ${hidden} hidden).`,
  );
  logger.log(`Password of every user: ${PASSWORD}`);
  for (const user of USERS) {
    logger.log(`  ${user.role.padEnd(6)} ${user.email}`);
  }
} finally {
  await app.close();
}
