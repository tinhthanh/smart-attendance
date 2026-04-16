export const QUEUE_NAMES = {
  SUMMARY: 'attendance-summary',
  CHECKOUT_CLOSE: 'attendance-checkout-close',
  ANOMALY: 'anomaly',
} as const;

export const JOB_NAMES = {
  DAILY_SUMMARY: 'daily-summary',
  MISSING_CHECKOUT_CLOSE: 'missing-checkout-close',
  ANOMALY_DETECTION: 'anomaly-detection',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

export const TIMEZONE = 'Asia/Ho_Chi_Minh';
