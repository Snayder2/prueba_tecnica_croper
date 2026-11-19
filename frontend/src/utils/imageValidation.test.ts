import { describe, expect, it } from 'vitest';
import { formatFileSize, formatPercent } from './formatters';
import { MAX_IMAGE_BYTES, validateImageFile } from './imageValidation';

const fileOf = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe('validateImageFile (spec 03 §13.4)', () => {
  it('accepts JPEG, PNG and WebP up to 1 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(1_048_576);
    expect(validateImageFile(fileOf('a.jpg', 'image/jpeg', 900 * 1024))).toEqual({ ok: true });
    expect(validateImageFile(fileOf('b.png', 'image/png', MAX_IMAGE_BYTES))).toEqual({ ok: true });
    expect(validateImageFile(fileOf('c.webp', 'image/webp', 10))).toEqual({ ok: true });
  });

  it('rejects a file over 1 MB with its size', () => {
    expect(validateImageFile(fileOf('foto.png', 'image/png', 2_411_724))).toEqual({
      ok: false,
      message: 'foto.png pesa 2,3 MB. El máximo es 1 MB.',
    });
    expect(validateImageFile(fileOf('justo.png', 'image/png', MAX_IMAGE_BYTES + 1)).ok).toBe(false);
  });

  it('rejects other formats', () => {
    expect(validateImageFile(fileOf('documento.pdf', 'application/pdf', 100))).toEqual({
      ok: false,
      message: 'documento.pdf no es una imagen válida. Usa JPG, PNG o WebP.',
    });
    expect(validateImageFile(fileOf('anim.gif', 'image/gif', 100)).ok).toBe(false);
  });
});

describe('formatters added in spec 03 §13.8', () => {
  it('formatFileSize uses base 1024 and a decimal comma', () => {
    expect(formatFileSize(2_411_724)).toBe('2,3 MB');
    expect(formatFileSize(1_048_576)).toBe('1 MB');
    expect(formatFileSize(512_000)).toBe('500 KB');
    expect(formatFileSize(800)).toBe('800 B');
  });

  it('formatPercent writes "15 %"', () => {
    expect(formatPercent(15)).toBe('15 %');
  });
});
