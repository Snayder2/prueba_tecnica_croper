import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskStorage } from './local-disk.storage.js';

describe('LocalDiskStorage', () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    const values: Record<string, string> = {
      UPLOADS_DIR: dir,
      PUBLIC_BASE_URL: 'http://localhost:3000/',
    };
    const config = { get: (key: string) => values[key] } as unknown as ConfigService;
    storage = new LocalDiskStorage(config as never);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves the file in <UPLOADS_DIR>/products, creating the folder', async () => {
    await storage.save('abc-123.webp', Buffer.from('webp-bytes'));

    await expect(readFile(join(dir, 'products', 'abc-123.webp'), 'utf8')).resolves.toBe('webp-bytes');
  });

  it('builds the absolute public URL from PUBLIC_BASE_URL', () => {
    expect(storage.getPublicUrl('abc-123_thumb.webp')).toBe(
      'http://localhost:3000/uploads/products/abc-123_thumb.webp',
    );
  });

  it('deletes the file, and deleting a missing file is not an error', async () => {
    await storage.save('abc-123.webp', Buffer.from('x'));

    await storage.delete('abc-123.webp');
    expect(existsSync(join(dir, 'products', 'abc-123.webp'))).toBe(false);
    await expect(storage.delete('abc-123.webp')).resolves.toBeUndefined();
  });

  it('rejects keys that could escape the folder', async () => {
    for (const key of ['../.env', 'a/b.webp', '..\\x.webp', 'sin-extension']) {
      await expect(storage.save(key, Buffer.from('x'))).rejects.toThrow('Invalid storage key');
      expect(() => storage.getPublicUrl(key)).toThrow('Invalid storage key');
    }
  });
});
