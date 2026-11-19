import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesModule } from '../images/images.module.js';
import { CatalogController } from './catalog.controller.js';
import { ProductImagesController } from './product-images.controller.js';
import { ProductsService } from './products.service.js';
import { Product, ProductSchema } from './schemas/product.schema.js';
import { SellerProductsController } from './seller-products.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    ImagesModule,
  ],
  controllers: [CatalogController, ProductImagesController, SellerProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
