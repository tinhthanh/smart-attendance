import { haversineDistance } from './geo';

describe('haversineDistance', () => {
  it('should return 0 when coordinates equal', () => {
    expect(haversineDistance(10, 20, 10, 20)).toBe(0);
  });

  it('should return ~111000m when 1 degree latitude apart at equator', () => {
    const d = haversineDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('should be symmetric regardless of order', () => {
    const a = haversineDistance(10.7766, 106.7009, 21.0285, 105.8542);
    const b = haversineDistance(21.0285, 105.8542, 10.7766, 106.7009);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  it('should compute HCM to HN distance ~1145km within 5km tolerance', () => {
    const d = haversineDistance(10.7766, 106.7009, 21.0285, 105.8542);
    expect(d).toBeGreaterThan(1_140_000);
    expect(d).toBeLessThan(1_150_000);
  });

  it('should compute antipodal distance ~20015km', () => {
    const d = haversineDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20_000_000);
    expect(d).toBeLessThan(20_020_000);
  });
});
