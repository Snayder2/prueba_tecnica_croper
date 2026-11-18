import { plainToInstance, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const REQUIRED = { message: '$property is required' };

export class EnvironmentVariables {
  @IsDefined(REQUIRED)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsDefined(REQUIRED)
  @IsNotEmpty(REQUIRED)
  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGO_URI must start with mongodb:// or mongodb+srv://',
  })
  MONGO_URI: string;

  @IsDefined(REQUIRED)
  @IsString()
  @IsNotEmpty(REQUIRED)
  JWT_SECRET: string;

  // Accepts a number of seconds or a number followed by s, m, h or d (e.g. "1h").
  @IsDefined(REQUIRED)
  @Matches(/^\d+[smhd]?$/, {
    message: 'JWT_EXPIRES_IN must be a number of seconds or a value like 30m, 1h, 1d',
  })
  JWT_EXPIRES_IN: string;

  @IsDefined(REQUIRED)
  @IsUrl(
    { require_tld: false, require_protocol: true },
    { message: 'CORS_ORIGIN must be a URL such as http://localhost:5173' },
  )
  CORS_ORIGIN: string;
}

/**
 * Used by ConfigModule.forRoot({ validate }). Throwing here aborts bootstrap,
 * so the app never starts with missing or invalid configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${Object.values(error.constraints ?? {})[0]}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration (see backend/.env.example):\n${details}`,
    );
  }

  return env;
}
