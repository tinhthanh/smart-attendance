# T-019 Plan — README polish + demo-script + architecture doc

> Generated 2026-04-16. Branch: `feature/readme-demo-docs`. 60' task, Day 5.

## Pre-work verify

| Check                                                                         | Status                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| README.md exists, 95% complete (15 H2 sections)                               | ✅ extend                                            |
| README placeholders: line 317 video link, line 319 demo-script, line 356 team | ⚠ fill 3 spots                                       |
| `docs/demo-script.md`                                                         | ❌ create                                            |
| `docs/architecture.md`                                                        | ❌ create                                            |
| `docs/spec.md` v0.1 (2026-04-15) — single changelog entry                     | ⚠ append v0.2 entry summarizing 5-day implementation |
| `docs/erd.md` has Mermaid syntax                                              | ✅ pattern to reuse for architecture.md              |
| `.github/workflows/ci.yml` exists (Node 20 + pnpm 10.18.1 + postgres svc)     | ✅ add CI badge to README                            |
| Seed: 3 branches × 10 emp = 30 employees, 7 days attendance, 3 test accounts  | ✅ accurate stats for demo                           |
| 17 merged PRs (T-001 → T-018) ; 21 PROMPT_LOG entries                         | ✅ growth narrative                                  |
| No `screenshots/` or `docs/img/` dirs                                         | leave (skip screenshots for time)                    |
| Tech stack table parity: README ⟷ CLAUDE.md                                   | ✅ aligned, no divergence                            |
| Mobile trust score cap ~55 (no WiFi plugin) — known limitation                | document                                             |
| Image size 326MB (target 300MB) — known limitation                            | document                                             |
| BullMQ shutdown hooks pending                                                 | document                                             |

## File structure

```
README.md                          # MODIFY — fill 3 placeholders + add CI badge
docs/
├── demo-script.md                 # NEW — 6-part 8-10' video script
├── architecture.md                # NEW — Mermaid diagram + scale narrative + trade-offs + limitations
└── spec.md                        # MODIFY — append v0.2 changelog entry (1 line)
```

Total: 2 new + 2 modify. ~600 LoC docs (Markdown).

## A. README.md changes (4 spots)

1. **CI badge** (after existing badges line 5-7):

   ```markdown
   [![CI](https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml)
   ```

2. **Demo section** (line 314-321 area):

   - Replace `(link YouTube/Drive sẽ thêm sau)` → `_Sẽ cập nhật sau khi quay video_` (more honest than fake URL)
   - Replace `(sẽ tạo)` → live link `[docs/demo-script.md](docs/demo-script.md)` (T-019 creates it)
   - Add `[docs/architecture.md](docs/architecture.md)` reference under 🏗️ Kiến trúc

3. **Team section** (line 356):

   - Replace `(điền tên + role)` → table với placeholder row for actual contributor info
   - Format: `| Tên | Vai trò | Email/GitHub |` — user fills before submission

4. **Quick start polish**: verify command sequence works from clean clone state. No edits if accurate (already T-018 verified).

## B. docs/demo-script.md (NEW) — outline

```
# Smart Attendance — Demo Script (8-10 phút)

## Setup trước khi quay
- Browser: Chrome DevTools sẵn (Sensors panel cho mock GPS)
- Terminal: docker compose up -d (đã chạy sẵn ~30s trước)
- Tab admin@demo.com đã login portal
- Tab employee001@demo.com mobile (responsive Chrome 375x812)
- 3 backups screenshots nếu live demo lỗi

## Phần 1 (1') — Giới thiệu
"Smart Attendance — chấm công cho doanh nghiệp 100 chi nhánh × 5.000 nhân viên..."
- Slide/text: Problem → Solution → Tech (Nx + NestJS + Ionic + Postgres)
- Highlight: Trust Score + Anomaly Detection (sáng tạo 25%)

## Phần 2 (2') — Admin: branch + employee management
- Login admin@demo.com → /dashboard (admin overview KPI + 2 charts + heatmap)
- /branches → existing 3 branches → "Tạo chi nhánh mới"
- Chi nhánh: code DEMO-LIVE, name "Demo Branch", lat 10.7769 lng 106.7009
- WiFi config: SSID "DemoWiFi", BSSID "AA:BB:CC:DD:EE:FF"
- Geofence: 10.7769, 106.7009, radius 100m
- /employees → tạo 1 employee mới gán DEMO-LIVE branch

## Phần 3 (3') — Mobile employee check-in flow
- Switch to mobile tab (employee001@demo.com)
- /home → status "Chưa check-in"
- DevTools Sensors → location 10.7770, 106.7010 (in geofence)
- Click "Chấm công vào" → success modal "Trust 85" + chip xanh "trusted"
- Mock fail: DevTools location 21.0285, 105.8542 (Hà Nội)
- Click check-out → fail dialog với primary "Ngoài vùng" + secondary chips
- Highlight: Vietnamese flag explanations + 4-tier severity color

## Phần 4 (2') — Manager dashboard + anomalies
- Login manager.hcm@demo.com → auto /dashboard/branch/<HCM-id>
- Show: today KPI + low_trust list + week trend chart
- /anomalies (admin tab) → branches_late_spike, employees_low_trust
- Click branch row → navigate /dashboard/branch/:id
- Click employee row → /employees/:id

## Phần 5 (1') — CSV export + Anti-fraud highlight
- /attendance → "Xuất CSV" button → modal progress polling → blob download
- Open .csv trong Excel → tiếng Việt render đúng
- Recap: 3-layer anti-fraud (hard validation / risk flags / trust score)
- 12 risk flags với 4-tier severity (xem README §🛡️)

## Phần 6 (1') — AI workflow walkthrough
- PROMPT_LOG.md scroll: 21 entries, 5 ngày
- 3-round workflow: PRE-WORK verify → PLAN 10 decisions → EXEC + smoke
- Pattern reuse: T-005 auth → T-007 employees, T-013 list/filter pattern reuse 3 lần
- Closing: "Toàn bộ MVP build trong 5 ngày với AI pair programming."
```

Each phase has bullet checklist + safety notes (backup screenshot fallback) + key talking points.

## C. docs/architecture.md (NEW) — outline

````
# Architecture — Smart Attendance

## 1. System overview (Mermaid)

```mermaid
flowchart LR
  subgraph Clients
    Mobile["Mobile (Ionic + Capacitor)"]
    Portal["Portal (Ionic Angular)"]
  end
  Mobile -->|HTTPS /api/v1| Nginx
  Portal -->|HTTPS /api/v1| Nginx
  Nginx -->|reverse proxy| API[NestJS API]
  API -->|Prisma| Postgres[(PostgreSQL 16)]
  API -->|cache + queue| Redis[(Redis 7)]
  API -->|BullMQ jobs| Worker[Cron jobs<br/>summary/anomaly/cleanup]
````

## 2. Layer responsibilities

(table: Layer | Tech | Why this choice)

## 3. Scale strategy — 100 branches × 5000 employees

- Peak load math (7:45-8:15, ~10 req/s)
- Index strategy (cite docs/erd.md §4)
- Read model `daily_attendance_summaries` (cite spec §7)
- Cache TTLs (branch config 5min, dashboard 60s)
- Horizontal scale path (stateless API, Postgres replica, Redis cluster)

## 4. Trade-offs (neutral framing)

| Decision              | Chosen         | Alternative      | Why                                                                      |
| --------------------- | -------------- | ---------------- | ------------------------------------------------------------------------ |
| Mobile + Portal stack | Ionic Angular  | Next.js + RN     | Single Angular skill, code reuse, faster MVP                             |
| ORM                   | Prisma         | TypeORM, raw SQL | Type-safe queries; analytics raw-SQL exception documented (CLAUDE.md §8) |
| Queue                 | BullMQ + Redis | RabbitMQ, Kafka  | Already need Redis for cache; BullMQ + @Cron hybrid simple               |
| Cache TTL             | 60s dashboard  | Real-time WS     | 60s acceptable for non-realtime KPI; defer SSE/WS                        |
| Multi-platform Docker | amd64 only     | amd64 + arm64    | MVP target; ARM via CI follow-up                                         |

## 5. Known limitations (transparent)

- Mobile trust score cap ~55 (no Capacitor 8 WiFi plugin available; spec §5.2 ack)
- API image 326MB (8.7% over 300MB budget — Prisma + Node alpine baseline)
- BullMQ workers lack `onModuleDestroy` shutdown hook (graceful close TODO)
- `cache-manager-ioredis-yet@2` silent fallback to in-memory (T-014 known issue)
- Mobile not Dockerized (dev mode only per assignment scope)

## 6. References

- spec.md §2/§5/§6 — business rules
- erd.md §3/§4 — schema + indexes
- api-spec.md §6/§10/§11 — contracts + errors + rate limits

````

## D. spec.md changelog append

```markdown
- v0.2 (2026-04-16): Hoàn tất MVP 5 ngày — 18 tasks (T-001→T-018) merged, 21 PROMPT_LOG entries, 75+ design lessons. Tất cả acceptance criteria passed. Known limitations: xem docs/architecture.md §5.
````

(Single-line append to existing §14 Changelog. No content rewrites.)

## Decisions — recommendations

| #   | Câu hỏi                 | Recommend                                                                                                         | Alt                                                   |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Screenshot placeholder  | **Skip — 0 screenshots** trong README. Defer to demo video                                                        | TODO comments — clutter                               |
| 2   | Demo video link         | **`_Sẽ cập nhật sau khi quay video_`** — honest placeholder                                                       | Fake `youtu.be/TBD` — looks broken/dishonest          |
| 3   | Architecture doc length | **Concise 1-page** Mermaid + 5 sections (overview/layers/scale/tradeoffs/limitations)                             | 3-page detailed — diminishing returns, reviewers skip |
| 4   | Scale narrative         | **Text-only** với Mermaid system overview                                                                         | Multiple diagrams — extra time, low ROI               |
| 5   | Trade-off framing       | **Neutral "we chose X because Y"** + alt column                                                                   | Positive hype — less credible                         |
| 6   | Team section            | **Placeholder table row** `\| _Điền tên_ \| _Điền role_ \| _Điền email/GitHub_ \|` — user fills before submission | Hardcode fake name                                    |
| 7   | CI badge                | **Include trong README header** (sau Stack/DB/Deploy badges)                                                      | Separate section — overkill                           |
| 8   | Known limitations       | **Architecture.md §5** chính. README chỉ link tới                                                                 | README clutter — limitations listed twice             |
| 9   | PROMPT_LOG reference    | **Quote: "21 entries, 18 tasks, ~75 lessons"** + link                                                             | Just link — loses growth narrative                    |
| 10  | Demo script audience    | **Self-shoot oriented** — bullet checklist + talking points (user tự quay)                                        | Detailed third-party script — overkill                |

## Extra decisions

- **D-extra-1**: README/Demo section reorder: keep current order; demo link → architecture link → demo-script.md link (3 lines).
- **D-extra-2**: Architecture Mermaid uses `flowchart LR` (left-right, fits desktop GitHub viewport). Check render trên GitHub UI sau khi push.
- **D-extra-3**: Team table 3 columns (Tên | Vai trò | Email/GitHub). User edits inline khi submit. Single placeholder row.
- **D-extra-4**: Don't change spec.md §14 wording — only append 1 line. Avoid scope creep into spec rewrite.
- **D-extra-5**: docs/demo-script.md sections numbered 1-6 với time budget (1'/2'/3'/2'/1'/1') = 10' total. Buffer 30s setup talk → fits 8-10' acceptance.

## Risk

| Risk                                                                              | Mitigation                                                                                                                        |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mermaid syntax không render trên GitHub                                           | Use proven `flowchart LR` syntax; test by viewing erd.md (already renders)                                                        |
| Demo script timing slip live (>10' overrun)                                       | Budget per section; backup: skip Phần 4 anomaly detail nếu thiếu time                                                             |
| README CI badge URL wrong (repo path)                                             | Confirm `tinhthanh/smart-attendance` from `git config --get remote.origin.url`                                                    |
| Architecture doc redundant với spec.md §2                                         | Architecture.md focuses on **deployment + scale + trade-offs + limitations** — distinct from spec which focuses on business logic |
| Spec changelog conflict if user already has v0.2 entry                            | Read spec.md §14 first; append only if missing                                                                                    |
| Trade-off section sounds like marketing                                           | Use neutral 4-column table (decision/chosen/alt/why); facts only                                                                  |
| Known limitations look like negatives                                             | Frame as "honest engineering tradeoffs"; cite spec §11 MVP scope                                                                  |
| Demo recommends mocking GPS via DevTools — may not work on user's browser version | Provide Chrome 100+ baseline + alt: emulate via mobile device profile                                                             |

## Testing

- **Markdown lint**: visual scan for header hierarchy (H1 → H2 → H3 strict), no broken intra-doc links
- **Link verification**: every `[text](path)` in README + new docs → file exists OR external URL plausible
- **Mermaid render**: paste diagram into [mermaid.live](https://mermaid.live) → confirm renders
- **Demo dry-run**: read script aloud with stopwatch — should fit 8-10' window without rushing
- **CI badge URL**: `curl -I https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml/badge.svg?branch=develop` → 200 (or 302 to image)

## Execution steps (sau confirm)

1. Verify GitHub repo URL: `git config --get remote.origin.url`
2. Add CI badge line to README header
3. Replace 3 placeholders trong README (video, demo-script link, architecture link in 🏗️ section)
4. Replace Team section: placeholder table row
5. Create `docs/demo-script.md` — 6-part outline (≤300 lines)
6. Create `docs/architecture.md` — 5 sections + Mermaid (≤200 lines)
7. Append 1 line to `docs/spec.md` §14 Changelog
8. Manual link check: open every new file, verify `[text](path)` resolve relative to repo root
9. Mermaid render test: copy block to mermaid.live → screenshot fits 1 page
10. Demo dry-read: time check 8-10'
11. **Không commit**

## Smoke verification (no servers needed — docs only)

````bash
# 1. Markdown link integrity
grep -oE '\[([^\]]+)\]\(([^)]+)\)' README.md docs/architecture.md docs/demo-script.md \
  | grep -v '^https?://' \
  | head -30
# Manually verify each link target exists

# 2. CI badge URL fetch
curl -sI "https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml/badge.svg?branch=develop" \
  | head -3
# Expect: 200 or 302

# 3. Mermaid syntax validate (manual)
# Copy ```mermaid block from architecture.md → paste mermaid.live → no syntax error

# 4. Word count sanity
wc -w README.md docs/demo-script.md docs/architecture.md
# README: ~1200 words, demo-script: ~800-1000, architecture: ~600-800
````

## Acceptance mapping (T-019 from tasks.md)

- [ ] Clone → docker compose up → working app < 10 phút (Quick Start verified) ✅
- [ ] README polished, no TBD/placeholder ✅
- [ ] Demo script ready ✅
- [ ] Architecture documented ✅
- [ ] Trade-offs honest ✅
- [ ] Known limitations transparent ✅

## Review checklist

- [ ] All README links resolve ✅
- [ ] CI badge added ✅
- [ ] Mermaid renders on GitHub ✅
- [ ] Demo script timing 8-10' ✅
- [ ] Trade-offs neutral framing ✅
- [ ] Known limitations honest (no hide) ✅
- [ ] No new dependencies ✅
- [ ] No code/logic changes (docs-only) ✅

Reply `OK hết` hoặc `# + extra#` cần đổi → exec.
