import { Types } from 'mongoose';
import { UserThrottlerGuard } from './user-throttler.guard.js';

/** Exposes the protected getTracker for the test. */
class TestableGuard extends UserThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('UserThrottlerGuard', () => {
  const guard = new TestableGuard({ throttlers: [] }, {} as never, {} as never);

  it('counts per authenticated user, not per IP', async () => {
    const userId = new Types.ObjectId();
    await expect(guard.tracker({ user: { _id: userId }, ip: '10.0.0.1' })).resolves.toBe(
      `user:${userId.toString()}`,
    );
  });

  it('two users behind the same IP get different trackers', async () => {
    const first = await guard.tracker({ user: { _id: new Types.ObjectId() }, ip: '10.0.0.1' });
    const second = await guard.tracker({ user: { _id: new Types.ObjectId() }, ip: '10.0.0.1' });
    expect(first).not.toBe(second);
  });

  it('falls back to the IP without a user', async () => {
    await expect(guard.tracker({ ip: '10.0.0.1' })).resolves.toBe('10.0.0.1');
  });
});
