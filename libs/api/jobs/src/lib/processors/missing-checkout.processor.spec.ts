import { Test } from '@nestjs/testing';
import { PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { MissingCheckoutProcessor } from './missing-checkout.processor';

describe('MissingCheckoutProcessor', () => {
  let processor: MissingCheckoutProcessor;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module = await Test.createTestingModule({
      providers: [
        MissingCheckoutProcessor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    processor = module.get(MissingCheckoutProcessor);
  });

  function makeJob(forDate = '2026-04-15'): Job<{ forDate: string }> {
    return { data: { forDate } } as unknown as Job<{ forDate: string }>;
  }

  it('should close sessions when check-in without check-out exists', async () => {
    prisma.attendanceSession.updateMany.mockResolvedValue({
      count: 3,
    } as never);

    const result = await processor.process(makeJob());

    expect(result.closed).toBe(3);
    expect(prisma.attendanceSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkInAt: { not: null },
          checkOutAt: null,
          status: { in: ['on_time', 'late'] },
        }),
        data: expect.objectContaining({
          status: 'missing_checkout',
          workedMinutes: null,
        }),
      })
    );
  });

  it('should return zero when no sessions match', async () => {
    prisma.attendanceSession.updateMany.mockResolvedValue({
      count: 0,
    } as never);
    const result = await processor.process(makeJob());
    expect(result.closed).toBe(0);
  });

  it('should skip sessions with manual override status via status filter', async () => {
    prisma.attendanceSession.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    await processor.process(makeJob());
    const call = prisma.attendanceSession.updateMany.mock.calls[0][0];
    expect((call.where as { status: { in: string[] } }).status.in).toEqual([
      'on_time',
      'late',
    ]);
  });
});
