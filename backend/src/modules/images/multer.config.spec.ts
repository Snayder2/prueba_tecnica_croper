import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ALLOWED_IMAGE_MIME, imageUploadOptions, MAX_IMAGE_BYTES } from './multer.config.js';

function runFilter(mimetype: string) {
  const callback = vi.fn();
  imageUploadOptions.fileFilter?.({} as never, { mimetype } as Express.Multer.File, callback);
  return callback;
}

describe('imageUploadOptions (Multer)', () => {
  it('keeps the file in memory and limits size, files, fields and parts', () => {
    expect(MAX_IMAGE_BYTES).toBe(1_048_576);
    expect(imageUploadOptions.storage).toBeDefined();
    expect(imageUploadOptions.limits).toEqual({
      fileSize: 1_048_576,
      files: 1,
      fields: 0,
      parts: 1,
    });
  });

  it.each(ALLOWED_IMAGE_MIME)('accepts a declared %s', (mimetype) => {
    expect(runFilter(mimetype)).toHaveBeenCalledWith(null, true);
  });

  it.each(['text/plain', 'image/gif', 'application/pdf', 'image/svg+xml'])(
    'rejects a declared %s with 415 "Unsupported file type"',
    (mimetype) => {
      const callback = runFilter(mimetype);
      const [error, accepted] = callback.mock.calls[0] as [Error, boolean];
      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect(error.message).toBe('Unsupported file type');
    },
  );
});
