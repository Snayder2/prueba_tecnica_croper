import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageFilePipe } from './image-file.pipe.js';

const asFile = (buffer: Buffer, mimetype = 'image/png') =>
  ({ buffer, size: buffer.length, mimetype, originalname: 'foto.png' }) as Express.Multer.File;

const image = (format: 'jpeg' | 'png' | 'webp' | 'gif') =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: '#00c853' } })
    .toFormat(format)
    .toBuffer();

describe('ImageFilePipe', () => {
  const pipe = new ImageFilePipe();

  it('throws 400 "Image is required" when there is no file', async () => {
    await expect(pipe.transform(undefined)).rejects.toThrow(new BadRequestException('Image is required'));
    await expect(pipe.transform(asFile(Buffer.alloc(0)))).rejects.toThrow(BadRequestException);
  });

  it.each(['jpeg', 'png', 'webp'] as const)('accepts a real %s', async (format) => {
    const file = asFile(await image(format));
    await expect(pipe.transform(file)).resolves.toBe(file);
  });

  it('rejects a text file renamed to .png (declared image/png) with 415', async () => {
    const file = asFile(Buffer.from('esto no es una imagen, solo texto'), 'image/png');
    await expect(pipe.transform(file)).rejects.toThrow(
      new UnsupportedMediaTypeException('Unsupported file type'),
    );
  });

  it('rejects other real image formats (GIF) with 415', async () => {
    await expect(pipe.transform(asFile(await image('gif'), 'image/png'))).rejects.toThrow(
      UnsupportedMediaTypeException,
    );
  });
});
