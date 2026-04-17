import * as fs from 'node:fs/promises';
import { ExportCleanupScheduler } from './export-cleanup.scheduler';
import { EXPORT_FILE_TTL_MS } from './reports.constants';

jest.mock('node:fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ExportCleanupScheduler', () => {
  let scheduler: ExportCleanupScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new ExportCleanupScheduler();
  });

  it('unlinks files older than TTL and keeps fresh ones', async () => {
    const now = Date.now();
    mockedFs.mkdir.mockResolvedValue(undefined as never);
    mockedFs.readdir.mockResolvedValue(['old.csv', 'new.csv'] as never);
    mockedFs.stat.mockImplementation(async (p) => {
      const isOld = String(p).endsWith('old.csv');
      return {
        isFile: () => true,
        mtimeMs: isOld ? now - EXPORT_FILE_TTL_MS - 1_000 : now - 60_000,
      } as never;
    });
    mockedFs.unlink.mockResolvedValue(undefined as never);

    const result = await scheduler.runCleanup();

    expect(result).toEqual({ deleted: 1, kept: 1 });
    expect(mockedFs.unlink).toHaveBeenCalledTimes(1);
    expect((mockedFs.unlink as jest.Mock).mock.calls[0][0]).toContain(
      'old.csv'
    );
  });

  it('skips directories and continues on per-entry errors', async () => {
    const now = Date.now();
    mockedFs.mkdir.mockResolvedValue(undefined as never);
    mockedFs.readdir.mockResolvedValue(['sub', 'broken', 'new.csv'] as never);
    mockedFs.stat.mockImplementation(async (p) => {
      const s = String(p);
      if (s.endsWith('sub'))
        return { isFile: () => false, mtimeMs: now } as never;
      if (s.endsWith('broken')) throw new Error('EACCES');
      return { isFile: () => true, mtimeMs: now - 60_000 } as never;
    });
    mockedFs.unlink.mockResolvedValue(undefined as never);

    const result = await scheduler.runCleanup();

    expect(result.deleted).toBe(0);
    expect(result.kept).toBe(1);
  });
});
