/**
 * Where product image files live (spec 03 §7.5). Services depend on this
 * abstraction only; this version uses LocalDiskStorage, and a cloud provider
 * (S3, Cloudinary) would be another implementation without touching them.
 * It is an abstract class (not an interface) so it can be the injection token.
 */
export abstract class StorageService {
  /** Stores the bytes under `key`, replacing any previous file. */
  abstract save(key: string, buffer: Buffer): Promise<void>;

  /** Removes the file. Deleting a key that does not exist is not an error. */
  abstract delete(key: string): Promise<void>;

  /** Absolute public URL of the file, built from PUBLIC_BASE_URL. */
  abstract getPublicUrl(key: string): string;
}
