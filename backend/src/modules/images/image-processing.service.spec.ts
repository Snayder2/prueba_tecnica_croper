import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessingService } from './image-processing.service.js';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#19334c' } });

describe('ImageProcessingService', () => {
  const service = new ImageProcessingService();

  it('re-encodes to WebP: large image up to 1200 px and a 400 × 400 thumbnail', async () => {
    const input = await solid(3000, 1500).jpeg().toBuffer();

    const result = await service.process(input);

    expect(result).toMatchObject({ width: 1200, height: 600 });
    const large = await sharp(result.large).metadata();
    const thumbnail = await sharp(result.thumbnail).metadata();
    expect(large).toMatchObject({ format: 'webp', width: 1200, height: 600 });
    expect(thumbnail).toMatchObject({ format: 'webp', width: 400, height: 400 });
  });

  it('never enlarges small images', async () => {
    const result = await service.process(await solid(300, 200).png().toBuffer());
    expect(result).toMatchObject({ width: 300, height: 200 });
  });

  it('removes EXIF metadata (GPS, camera, etc.) and applies the orientation', async () => {
    // Orientation 6 = rotated 90°: a 200 × 100 photo must come out as 100 × 200.
    const input = await solid(200, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: 'Camara de prueba', Copyright: 'Privado' } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await service.process(input);

    const large = await sharp(result.large).metadata();
    expect(large.exif).toBeUndefined();
    expect(large.orientation).toBeUndefined();
    expect(result).toMatchObject({ width: 100, height: 200 });
  });

  it('rejects images over 40 megapixels with 400 "Image dimensions too large"', async () => {
    const huge = await solid(7000, 6000).png({ compressionLevel: 9 }).toBuffer();

    await expect(service.process(huge)).rejects.toThrow(
      new BadRequestException('Image dimensions too large'),
    );
  });

  it('rejects data that cannot be decoded with 415', async () => {
    const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

    await expect(service.process(broken)).rejects.toThrow(
      new UnsupportedMediaTypeException('Unsupported file type'),
    );
  });
});
