import { Test } from '@nestjs/testing';
import { PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { DailySummaryProcessor } from './daily-summary.processor';

describe('DailySummaryProcessor', () => {
  let processor: DailySummaryProcessor;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module = await Test.createTestingModule({
      providers: [
        DailySummaryProcessor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    processor = module.get(DailySummaryProcessor);
  });

  function makeJob(forDate = '2026-04-15'): Job<{ forDate: string }> {
    return { data: { forDate } } as unknown as Job<{ forDate: string }>;
  }

  it('should upsert summary for each active employee when called', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', primaryBranchId: 'b1' },
      { id: 'e2', primaryBranchId: 'b1' },
    ] as never);
    prisma.attendanceSession.findMany.mockResolvedValue([
      {
        employeeId: 'e1',
        branchId: 'b1',
        workDate: new Date('2026-04-15T00:00:00Z'),
        status: 'on_time',
        checkInAt: new Date(),
        checkOutAt: new Date(),
        workedMinutes: 480,
        overtimeMinutes: 0,
        trustScore: 85,
      },
    ] as never);
    prisma.dailyAttendanceSummary.upsert.mockResolvedValue({} as never);

    const result = await processor.process(makeJob());

    expect(result.upserted).toBe(2);
    expect(result.absent).toBe(1);
    expect(prisma.dailyAttendanceSummary.upsert).toHaveBeenCalledTimes(2);
  });

  it('should create absent row when employee has no session', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e-absent', primaryBranchId: 'b1' },
    ] as never);
    prisma.attendanceSession.findMany.mockResolvedValue([] as never);
    prisma.dailyAttendanceSummary.upsert.mockResolvedValue({} as never);

    const result = await processor.process(makeJob());

    expect(result.absent).toBe(1);
    const call = prisma.dailyAttendanceSummary.upsert.mock.calls[0][0];
    expect((call.create as { status: string }).status).toBe('absent');
  });

  it('should be idempotent when called twice with same date', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', primaryBranchId: 'b1' },
    ] as never);
    prisma.attendanceSession.findMany.mockResolvedValue([] as never);
    prisma.dailyAttendanceSummary.upsert.mockResolvedValue({} as never);

    const r1 = await processor.process(makeJob());
    const r2 = await processor.process(makeJob());

    expect(r1.upserted).toBe(r2.upserted);
    expect(r1.absent).toBe(r2.absent);
  });

  it('should only aggregate closed sessions when calling findMany', async () => {
    prisma.employee.findMany.mockResolvedValue([] as never);
    prisma.attendanceSession.findMany.mockResolvedValue([] as never);

    await processor.process(makeJob());

    const whereArg = prisma.attendanceSession.findMany.mock.calls[0][0];
    expect(whereArg?.where?.OR).toBeDefined();
  });
});
