import {
  BadRequestException,
  Injectable,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { ALLOWED_IMAGE_MIME } from './multer.config.js';

/**
 * Validates the uploaded image (spec 03 §7.2):
 * - the file is required → 400 "Image is required";
 * - its real type, read from the first bytes (magic numbers), must be JPEG,
 *   PNG or WebP → otherwise 415 "Unsupported file type".
 * The declared Content-Type and the file name are chosen by the client and can
 * be faked; this check is the one that counts.
 */
@Injectable()
export class ImageFilePipe implements PipeTransform<
  Express.Multer.File | undefined,
  Promise<Express.Multer.File>
> {
  async transform(file: Express.Multer.File | undefined): Promise<Express.Multer.File> {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Image is required');
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_IMAGE_MIME.includes(detected.mime)) {
      throw new UnsupportedMediaTypeException('Unsupported file type');
    }
    return file;
  }
}
