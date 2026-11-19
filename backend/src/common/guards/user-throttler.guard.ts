import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit per user instead of per IP (contract §8, image uploads).
 * The global ThrottlerGuard runs before JwtAuthGuard and cannot see the user,
 * so this guard is added on the route, after JwtAuthGuard and RolesGuard.
 * It reads the limits from the route's @Throttle().
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { _id?: { toString(): string } } | undefined;
    return Promise.resolve(user?._id ? `user:${user._id.toString()}` : String(req.ip));
  }
}
