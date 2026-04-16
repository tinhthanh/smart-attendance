# T-016 Plan — CSV export (BullMQ async job + download)

> Generated 2026-04-16. Branch: `feature/csv-export`. 45' task, Day 4.

## Pre-work verify

| Check                                                                          | Status     |
| ------------------------------------------------------------------------------ | ---------- |
| `libs/api/jobs` — BullMQ + scheduler + processor pattern (T-014)               | ✅ reuse   |
| `libs/api/common` — PrismaService, AuditLogService, scope helpers              | ✅ reuse   |
| `attendance_sessions` + `employee`, `branch` relations                         | ✅ (T-003) |
| Portal `/attendance` list page (T-013) — place for Export button               | ✅         |
| Rate limit pattern (`@nestjs/throttler` + UserThrottlerGuard from T-005/T-009) | ✅ reuse   |

## No schema change. 1 new dep.

| Package               | Version | Why                                      |
| --------------------- | ------- | ---------------------------------------- |
| `csv-stringify` (dep) | `6.7.0` | Streaming-friendly, Node-native, 0 peers |

No `papaparse` — papaparse optimizes for browser parsing, not streaming Node output.

## Library + file structure

```
libs/api/reports/                                 # NEW
├── src/
│   ├── index.ts
│   └── lib/
│       ├── reports.module.ts                    # register queue + controller + processor
│       ├── reports.controller.ts                # 3 endpoints
│       ├── reports.service.ts                   # createExportJob, getStatus, streamFile
│       ├── export.processor.ts                  # @Processor('report-export')
│       ├── export-cleanup.scheduler.ts          # @Cron hourly — delete files > 1h
│       ├── dto/
│       │   └── create-export.dto.ts
│       └── *.spec.ts

apps/portal/src/app/
├── core/reports/
│   └── reports.api.service.ts                   # 3 HTTP methods
├── pages/attendance/
│   └── sessions-list.page.ts                    # MODIFY: +Export CSV button + modal
└── pages/attendance/
    └── export-progress.modal.ts                 # NEW: progress polling

apps/api/src/app/app.module.ts                   # MODIFY — +ReportsModule
```

Import path: `@smart-attendance/api/reports`.

## Endpoints (api-spec §6 exact)

| Method | Path                              | Role            | Behavior                                            |
| ------ | --------------------------------- | --------------- | --------------------------------------------------- |
| POST   | `/reports/export`                 | admin + manager | Throttled 3/60s per user. Returns 202 with `job_id` |
| GET    | `/reports/export/:jobId`          | admin + manager | Returns status + download_url when completed        |
| GET    | `/reports/export/:jobId/download` | admin + manager | Streams CSV file, sets Content-Disposition          |

Rate limit: `@SkipThrottle()` + `@UseGuards(UserThrottlerGuard)` + `@Throttle({ default: { ttl: 60_000, limit: 3 } })` per `RATE_LIMITS.EXPORT` constant (add to libs/shared/constants).

## Export queue + processor

```typescript
@Processor('report-export', { concurrency: 1 })
export class ExportProcessor extends WorkerHost {
  async process(job: Job<ExportJobData>): Promise<ExportJobResult> {
    const start = Date.now();
    const { jobId, type, branchId, dateFrom, dateTo, requestedBy } = job.data;

    // 1. Fetch sessions (stream in batches of 500)
    const where = {
      workDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      ...(branchId && { branchId }),
    };

    const filePath = path.join(EXPORTS_DIR, `${jobId}.csv`);
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    const writeStream = fs.createWriteStream(filePath);
    // UTF-8 BOM for Excel compatibility
    writeStream.write('\uFEFF');

    const stringifier = stringify({
      header: true,
      columns: ['Ngày', 'Mã NV', 'Họ tên', 'Chi nhánh', 'Check-in', 'Check-out', 'Số phút làm', 'Trạng thái', 'Trust Score'],
    });
    stringifier.pipe(writeStream);

    let rowCount = 0;
    const BATCH_SIZE = 500;
    let cursor: string | undefined;
    while (true) {
      const batch = await this.prisma.attendanceSession.findMany({
        where,
        take: BATCH_SIZE,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { id: 'asc' },
        include: {
          employee: { select: { employeeCode: true, user: { select: { fullName: true } } } },
          branch: { select: { name: true } },
        },
      });
      if (batch.length === 0) break;
      for (const s of batch) {
        stringifier.write([s.workDate.toISOString().slice(0, 10), s.employee.employeeCode, s.employee.user.fullName, s.branch.name, s.checkInAt?.toISOString() ?? '', s.checkOutAt?.toISOString() ?? '', s.workedMinutes ?? '', s.status, s.trustScore ?? '']);
        rowCount++;
      }
      cursor = batch[batch.length - 1].id;
      if (batch.length < BATCH_SIZE) break;
      if (rowCount >= MAX_ROWS) break; // safety cap
    }
    stringifier.end();
    await new Promise((resolve) => writeStream.on('close', resolve));

    // Audit
    await this.audit.log({
      userId: requestedBy,
      action: 'create',
      entityType: 'ReportExport',
      entityId: jobId,
      after: { type, branchId, dateFrom, dateTo, rowCount, filePath },
    });

    return {
      file_path: filePath,
      row_count: rowCount,
      bytes: fs.statSync(filePath).size,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      duration_ms: Date.now() - start,
    };
  }
}
```

## Cleanup scheduler

```typescript
@Injectable()
export class ExportCleanupScheduler {
  @Cron('0 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' }) // every hour
  async cleanupExpired() {
    const now = Date.now();
    const files = await fs.readdir(EXPORTS_DIR);
    for (const f of files) {
      const p = path.join(EXPORTS_DIR, f);
      const stat = await fs.stat(p);
      if (now - stat.mtimeMs > 3_600_000) {
        await fs.unlink(p);
      }
    }
  }
}
```

## Service API

```typescript
@Injectable()
export class ReportsService {
  async createExportJob(user: UserRolesContext, dto: CreateExportDto): Promise<{ job_id: string; status: string }> {
    // Scope check for manager
    if (!isAdmin(user) && dto.branch_id) {
      const scope = await getManagerBranchIds(this.prisma, user.id);
      if (!scope.includes(dto.branch_id)) throw FORBIDDEN;
    }
    const jobId = randomUUID();
    await this.queue.add('attendance-csv', { jobId, type: dto.type, branchId: dto.branch_id, dateFrom: dto.date_from, dateTo: dto.date_to, requestedBy: user.id }, { jobId, attempts: 1, removeOnComplete: false, removeOnFail: false });
    return { job_id: jobId, status: 'queued' };
  }

  async getJobStatus(user: UserRolesContext, jobId: string): Promise<ExportStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job) throw NOT_FOUND;
    // Optional: scope check via job.data.requestedBy === user.id || admin
    if (!isAdmin(user) && job.data.requestedBy !== user.id) throw FORBIDDEN;
    const state = await job.getState();
    return {
      job_id: jobId,
      status: state as 'queued' | 'processing' | 'completed' | 'failed',
      download_url: state === 'completed' ? `/api/v1/reports/export/${jobId}/download` : undefined,
      expires_at: job.returnvalue?.expires_at,
    };
  }

  async streamFile(user: UserRolesContext, jobId: string): Promise<{ stream: Readable; filename: string }> {
    const job = await this.queue.getJob(jobId);
    if (!job || (!isAdmin(user) && job.data.requestedBy !== user.id)) throw NOT_FOUND;
    const state = await job.getState();
    if (state !== 'completed') throw BUSINESS('Report not ready');
    const filePath = job.returnvalue.file_path;
    if (!fs.existsSync(filePath)) throw NOT_FOUND('File expired or missing');
    return {
      stream: fs.createReadStream(filePath),
      filename: `attendance_${jobId.slice(0, 8)}.csv`,
    };
  }
}
```

## DTO

```typescript
export class CreateExportDto {
  @IsIn(['attendance_csv']) type!: 'attendance_csv';
  @IsOptional() @IsUUID() branch_id?: string;
  @IsISO8601({ strict: true }) date_from!: string;
  @IsISO8601({ strict: true }) date_to!: string;
}
```

## Frontend modal + API

```typescript
// core/reports/reports.api.service.ts
@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private api = inject(ApiService);
  createExport(dto: CreateExportDto): Observable<ItemResponse<{ job_id: string; status: string }>> { ... }
  getStatus(jobId: string): Observable<ItemResponse<ExportStatus>> { ... }
  // Download: use window.open with Bearer — tricky. Use Blob fetch with Auth header instead.
  downloadFile(jobId: string): Observable<Blob> { this.http.get(...download, { responseType: 'blob' }) }
}
```

`/attendance` sessions list page → add `<ion-button>` "Xuất CSV" → opens `ExportProgressModal` with current query filters. Modal polls `getStatus` every 2s until `completed` → auto-triggers `downloadFile` → blob URL + `<a download>`.

## Decisions — recommendations

| #   | Câu hỏi                | Recommend                                                                              | Alt                                                            |
| --- | ---------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | CSV library            | **`csv-stringify@6.7.0`** — streaming Node-native, 0 peers                             | papaparse — browser-first, ESM quirks                          |
| 2   | File storage           | **Local `/tmp/reports/<jobId>.csv`** (MVP)                                             | BullMQ result data — 1MB+ blows up Redis                       |
| 3   | Cleanup                | **Separate @Cron every hour** (reuse T-014 pattern)                                    | BullMQ `removeOnComplete` — deletes job metadata, orphans file |
| 4   | Export button location | **Inline on `/attendance` list** — uses current filters (intuitive UX)                 | Separate `/reports` route — extra nav                          |
| 5   | Status polling         | **2s interval via setTimeout recursion** — simple, stops when completed                | WebSocket/SSE — overkill for 5-15s jobs                        |
| 6   | Max rows               | **10_000 row cap** — safety limit, returns warning if truncated                        | Unlimited — memory risk                                        |
| 7   | CSV write strategy     | **Streaming via `csv-stringify.pipe()` into `fs.createWriteStream`** — constant memory | Build string in-memory — OOM at 10k                            |
| 8   | Email notification     | **Defer** — spec §6 not required                                                       | Add now — needs SMTP config                                    |
| 9   | Export types           | **Only `attendance_csv`** for MVP per spec                                             | Multi-type — scope creep                                       |
| 10  | Job timeout            | **5 minutes** BullMQ default `attempts: 1` + `settled` timeout                         | 30s — too tight for 10k rows                                   |

## Extra decisions

- **D-extra-1**: `jobId = randomUUID()` — user-facing UUID, matches BullMQ job.id. Enables URL-safe job tracking.
- **D-extra-2**: Audit log entry via `AuditLogService.log()` (non-transactional — file I/O outside DB). Record inside processor after file write.
- **D-extra-3**: Download auth — use `HttpClient.get(blob, { responseType: 'blob' })` with Bearer token (interceptor) + `URL.createObjectURL(blob)` + programmatic `<a download>` click. Avoids exposing token in URL.
- **D-extra-4**: `Content-Disposition: attachment; filename="attendance_<jobId>.csv"` set by backend via `@Res()` raw response.
- **D-extra-5**: `/tmp/reports/` dir created on boot via module init. Cleanup scheduler runs every hour in `Asia/Ho_Chi_Minh` TZ.

## Risk

| Risk                                                      | Mitigation                                                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/tmp` cleared on server restart → in-flight exports lost | MVP — acceptable. Production should use S3.                                                                                                        |
| Disk fill if many concurrent exports                      | 1h cleanup scheduler + 10k row cap → max ~2MB each                                                                                                 |
| Streaming backpressure when writing > 10k rows            | `csv-stringify.pipe()` handles backpressure natively                                                                                               |
| Audit log outside transaction — file vs DB mismatch       | Audit after `writeStream.close` — file guaranteed flushed. If audit fails, job still retries (attempts=1 but we could bump) — accept partial state |
| Manager tries to poll other user's job                    | Service-level scope check via `job.data.requestedBy`                                                                                               |
| Download URL guessable UUID — unauthorized download       | `GET /download` also enforces `@Roles('admin','manager')` + scope check                                                                            |
| Frontend blob URL leak                                    | `URL.revokeObjectURL()` after download trigger                                                                                                     |
| Vietnamese characters in CSV mojibake in Excel            | UTF-8 BOM `\uFEFF` prefix — tested pattern                                                                                                         |
| BullMQ `getJob(id)` after TTL expiry returns null         | `removeOnComplete: false` keeps job for 1h. Align with file TTL.                                                                                   |

## Testing

**Backend**:

- `ExportProcessor.process` — small dataset (5 rows), mock Prisma batches, assert file written, row_count matches
- `ReportsService.createExportJob` — admin can create with any branch_id, manager outside scope throws FORBIDDEN
- `ReportsService.getJobStatus` — returns `completed` when job returnvalue set
- `ExportCleanupScheduler.cleanupExpired` — mock fs.readdir, assert unlink called for old files only

## Execution steps (sau confirm)

1. Install: `pnpm add -w csv-stringify@6.7.0`
2. Add `RATE_LIMITS.EXPORT` constant in `libs/shared/constants`
3. Generate lib: `nx g @nx/nest:lib --name=reports --directory=libs/api/reports --importPath=@smart-attendance/api/reports`
4. Write `dto/create-export.dto.ts`
5. Write `export.processor.ts` + `export-cleanup.scheduler.ts` + `reports.service.ts` + `reports.controller.ts` + `reports.module.ts`
6. Wire `ReportsModule` into `app.module.ts`
7. Unit tests (2-3 specs)
8. Frontend: `core/reports/reports.api.service.ts`
9. Frontend: `pages/attendance/export-progress.modal.{ts,html}` — polling + download
10. Frontend: modify `sessions-list.page.ts` → add "Xuất CSV" button
11. `pnpm nx reset && pnpm nx test reports`
12. Start api + portal → admin smoke curl/browser test
13. **Không commit**

## Smoke test (via curl + browser)

```bash
TOKEN=$(login admin)

# 1. POST create export
curl -X POST http://localhost:3000/api/v1/reports/export \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"attendance_csv","date_from":"2026-04-09","date_to":"2026-04-16"}'
# → 202 { job_id, status: queued }

# 2. Poll status (should complete < 5s for ~210 sessions)
curl http://localhost:3000/api/v1/reports/export/<jobId> -H "Authorization: Bearer $TOKEN"
# → { status: completed, download_url, expires_at }

# 3. Download
curl -o report.csv http://localhost:3000/api/v1/reports/export/<jobId>/download -H "Authorization: Bearer $TOKEN"
file report.csv   # UTF-8 text
head -3 report.csv
# Excel test: open in Excel/LibreOffice, verify tiếng Việt render correctly

# 4. Rate limit: 4 rapid requests → 4th = 429
for i in 1 2 3 4; do curl -X POST .../export -d '{...}' -o /dev/null -w '%{http_code}\n'; done

# 5. Expiry cleanup (dev)
# Verify /tmp/reports/<jobId>.csv exists, touch -t 202504151000 /tmp/reports/<jobId>.csv
# Manual run scheduler OR wait hourly → file gone

# 6. Browser: /attendance → click "Xuất CSV" → modal progress → auto-download
```

## Acceptance mapping

- [ ] Export 1000 rows < 5s → smoke 1-2 timing ✅
- [ ] Job status poll smooth → modal 2s polling ✅
- [ ] CSV Excel-compatible with Vietnamese → UTF-8 BOM + Excel smoke ✅
- [ ] File expire cleaned up → scheduler @Cron ✅

## Review checklist

- [ ] Async (not blocking) — BullMQ queue ✅
- [ ] Streaming CSV — `csv-stringify.pipe()` ✅
- [ ] UTF-8 BOM ✅
- [ ] Rate limit 3/min/user ✅
- [ ] Audit log every export ✅
- [ ] File expire 1h ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
