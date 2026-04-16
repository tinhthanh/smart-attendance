export const RATE_LIMITS = {
  LOGIN: { ttl: 60_000, limit: 5 },
  CHECK_IN: { ttl: 60_000, limit: 10 },
  EXPORT: { ttl: 60_000, limit: 3 },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;
