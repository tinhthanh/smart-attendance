import { ErrorCode } from './error-codes';

describe('ErrorCode', () => {
  it('should define canonical codes per docs/api-spec.md §10', () => {
    expect(ErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ErrorCode.TOO_MANY_ATTEMPTS).toBe('TOO_MANY_ATTEMPTS');
    expect(ErrorCode.REFRESH_REPLAY_DETECTED).toBe('REFRESH_REPLAY_DETECTED');
  });
});
