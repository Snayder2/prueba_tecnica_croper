import type { UserRole } from '../../users/schemas/user.schema.js';

export interface JwtPayload {
  /** User id */
  sub: string;
  email: string;
  role: UserRole;
}
