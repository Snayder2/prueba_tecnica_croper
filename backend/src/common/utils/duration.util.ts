const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Converts JWT_EXPIRES_IN ("3600", "30m", "1h", "1d") to seconds.
 * The format is already enforced by env.validation.ts.
 */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  return Number(match[1]) * UNIT_SECONDS[match[2] ?? 's'];
}
