import { Module } from '@nestjs/common';
import { ImageFilePipe } from './image-file.pipe.js';
import { ImageProcessingService } from './image-processing.service.js';

@Module({
  providers: [ImageProcessingService, ImageFilePipe],
  exports: [ImageProcessingService, ImageFilePipe],
})
export class ImagesModule {}
