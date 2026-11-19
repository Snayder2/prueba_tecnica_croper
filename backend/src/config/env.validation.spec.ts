import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

const valid = {
  PORT: '3000',
  MONGO_URI: 'mongodb://localhost:27017/productos_db',
  JWT_SECRET: 'un-secreto-largo',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGIN: 'http://localhost:5173',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  UPLOADS_DIR: './uploads',
};

describe('validateEnv', () => {
  it('accepts a complete configuration and converts PORT to a number', () => {
    expect(validateEnv(valid)).toMatchObject({ ...valid, PORT: 3000 });
  });

  it.each(['JWT_SECRET', 'MONGO_URI', 'PUBLIC_BASE_URL', 'UPLOADS_DIR'])(
    'refuses to start without %s',
    (key) => {
      const config: Record<string, string> = { ...valid };
      delete config[key];
      expect(() => validateEnv(config)).toThrow(`${key} is required`);
    },
  );

  it('requires PUBLIC_BASE_URL to be a URL with protocol', () => {
    expect(() => validateEnv({ ...valid, PUBLIC_BASE_URL: 'localhost:3000' })).toThrow(
      'PUBLIC_BASE_URL must be a URL such as http://localhost:3000',
    );
  });
});
