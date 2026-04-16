import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@smart-attendance/api/common';
import type { Cache } from 'cache-manager';
import { Job } from 'bullmq';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AnomalyProcessor } from './anomaly.processor';

describe('AnomalyProcessor', () => {
  let processor: AnomalyProcessor;
  let prisma: DeepMockProxy<PrismaService>;
  let cache: DeepMockProxy<Cache>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cache = mockDeep<Cache>();
    const module = await Test.createTestingModule({
      providers: [
        AnomalyProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    processor = module.get(AnomalyProcessor);
  });

  function makeJob(asOf = '2026-04-15'): Job<{ asOf: string }> {
    return { data: { asOf } } as unknown as Job<{ asOf: string }>;
  }

  it('should cache result with key anomaly asOf date', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ employee_id: 'e1', low_count: BigInt(4) }])
      .mockResolvedValueOnce([{ employee_id: 'e1', device_id: 'd1' }])
      .mockResolvedValueOnce([]);

    const result = await processor.process(makeJob('2026-04-15'));

    expect(cache.set).toHaveBeenCalledWith(
      'anomaly:2026-04-15',
      expect.anything(),
      3_600_000
    );
    expect(result.suspicious_employees).toEqual([
      { employee_id: 'e1', count: 4 },
    ]);
    expect(result.untrusted_devices).toEqual([
      { employee_id: 'e1', device_id: 'd1' },
    ]);
  });

  it('should return empty arrays when no anomalies found', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await processor.process(makeJob());

    expect(result.suspicious_employees).toEqual([]);
    expect(result.untrusted_devices).toEqual([]);
    expect(result.branches_high_late_rate).toEqual([]);
  });

  it('should produce shape matching dashboard contract', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await processor.process(makeJob('2026-04-15'));

    expect(result).toEqual(
      expect.objectContaining({
        asOf: '2026-04-15',
        suspicious_employees: expect.any(Array),
        untrusted_devices: expect.any(Array),
        branches_high_late_rate: expect.any(Array),
        generated_at: expect.any(String),
      })
    );
  });
});
