# T-017 Plan — Anti-fraud UX polish (risk flags + severity + navigation)

> Generated 2026-04-16. Branch: `feature/anti-fraud-polish`. 60' task, Day 5.

## Pre-work verify

| Check                                                                                                             | Status                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `libs/shared/utils/src/lib/trust-score.types.ts` — `TrustFlag` union (12 values)                                  | ✅ canonical              |
| Backend writes flags via `attendance.service.ts:134/214/351` (`risk_flags: scoreResult.flags`)                    | ✅ no change              |
| Mobile `error-toast.util.ts` — partial VN flag map (7/12 flags, missing positive flags)                           | ⚠ extend                  |
| Portal `error-toast.util.ts` — NO flag mapping (raw strings shown)                                                | ❌ add                    |
| Mobile home `showFailDialog(risk_flags, distance)` already uses flag→msg                                          | ✅ reuse                  |
| Mobile history shows trust_score badge, no flags                                                                  | leave                     |
| Portal session-detail shows flags as warning chips (single color)                                                 | upgrade to severity       |
| Portal branch-dashboard low_trust shows flags as warning chips                                                    | upgrade to severity       |
| Portal anomalies page — rows NOT clickable                                                                        | add navigation            |
| `/dashboard/branch/:id` route exists ✅ ; `/employees/:id` detail exists ✅ ; `/employees/:id/devices` NOT exists | navigate to existing only |
| Severity 3-tier color pattern (success/warning/danger) established for trust_score                                | ✅ reuse same colors      |
| package.json — no leaflet/mapbox/google-maps                                                                      | confirm Option C          |

## All 12 risk flags (canonical from `trust-score.types.ts`)

```
gps_in_geofence_high_accuracy     ← positive (success)
gps_in_geofence_moderate_accuracy ← positive but warn-ish (info)
gps_outside_geofence              ← warning
bssid_match                       ← positive (success)
ssid_only_match                   ← info
wifi_mismatch                     ← warning
mock_location                     ← suspicious (danger)
accuracy_poor                     ← warning
device_trusted                    ← positive (success)
device_untrusted                  ← info
impossible_travel                 ← suspicious (danger)
vpn_suspected                     ← suspicious (danger)
```

## No schema change. No new dep. No new route.

## File structure

```
libs/shared/constants/src/lib/
└── risk-flags.ts                              # NEW — single source of truth (flag → label_vi + severity + icon)

apps/portal/src/app/
├── core/util/
│   └── error-toast.util.ts                    # MODIFY — import flag map from shared
├── shared/components/                          # NEW dir
│   └── risk-flag-chip.component.ts            # NEW — standalone <app-risk-flag-chip [flag]>
├── pages/attendance/
│   └── session-detail.page.{ts,html}          # MODIFY — replace inline chips with RiskFlagChipComponent + tooltip
├── pages/branch-dashboard/
│   └── branch-dashboard.page.{ts,html}        # MODIFY — same upgrade
└── pages/anomalies/
    └── anomalies.page.{ts,html}               # MODIFY — branches → /dashboard/branch/:id ; employees → /employees/:id

apps/mobile/src/app/
├── core/util/
│   └── error-toast.util.ts                    # MODIFY — import shared map (drop local FLAG_MESSAGES)
└── pages/home/
    └── home.page.ts                           # MODIFY — `showFailDialog` highlights 1 primary flag by severity rank

README.md                                       # MODIFY — short "Anti-fraud strategy" section (3 paragraphs)
```

Total: 1 new lib file + 1 new component + 6 modify + README. ~250 LoC change.

## Risk flag map (shared)

```typescript
// libs/shared/constants/src/lib/risk-flags.ts
export type RiskFlagSeverity = 'success' | 'info' | 'warning' | 'danger';

export interface RiskFlagDefinition {
  label_vi: string; // Short label inside chip (≤24 chars)
  description_vi: string; // Tooltip / dialog detail
  severity: RiskFlagSeverity;
  icon: string; // ionicons name
}

export const RISK_FLAGS: Record<string, RiskFlagDefinition> = {
  gps_in_geofence_high_accuracy: {
    label_vi: 'GPS chính xác',
    description_vi: 'Vị trí trong vùng cho phép, độ chính xác cao',
    severity: 'success',
    icon: 'location-outline',
  },
  gps_in_geofence_moderate_accuracy: {
    label_vi: 'GPS trung bình',
    description_vi: 'Vị trí trong vùng, độ chính xác trung bình',
    severity: 'info',
    icon: 'location-outline',
  },
  gps_outside_geofence: {
    label_vi: 'Ngoài vùng',
    description_vi: 'Vị trí GPS nằm ngoài bán kính cho phép của chi nhánh',
    severity: 'warning',
    icon: 'navigate-circle-outline',
  },
  bssid_match: {
    label_vi: 'WiFi khớp',
    description_vi: 'Đang kết nối WiFi của chi nhánh (BSSID khớp)',
    severity: 'success',
    icon: 'wifi-outline',
  },
  ssid_only_match: {
    label_vi: 'WiFi gần đúng',
    description_vi: 'Tên WiFi đúng nhưng địa chỉ phần cứng (BSSID) không khớp',
    severity: 'info',
    icon: 'wifi-outline',
  },
  wifi_mismatch: {
    label_vi: 'WiFi sai',
    description_vi: 'WiFi đang kết nối không phải của công ty',
    severity: 'warning',
    icon: 'wifi-outline',
  },
  mock_location: {
    label_vi: 'Giả lập vị trí',
    description_vi: 'Phát hiện ứng dụng giả lập GPS — phiên đáng nghi',
    severity: 'danger',
    icon: 'warning-outline',
  },
  accuracy_poor: {
    label_vi: 'GPS yếu',
    description_vi: 'Sai số GPS quá lớn — vui lòng ra chỗ thoáng',
    severity: 'warning',
    icon: 'alert-circle-outline',
  },
  device_trusted: {
    label_vi: 'Thiết bị tin cậy',
    description_vi: 'Thiết bị đã được xác minh trước đây',
    severity: 'success',
    icon: 'shield-checkmark-outline',
  },
  device_untrusted: {
    label_vi: 'Thiết bị mới',
    description_vi: 'Thiết bị lần đầu sử dụng — đang chờ xác minh',
    severity: 'info',
    icon: 'help-circle-outline',
  },
  impossible_travel: {
    label_vi: 'Di chuyển bất thường',
    description_vi: 'Khoảng cách giữa hai lần check-in vượt vận tốc tối đa',
    severity: 'danger',
    icon: 'flash-outline',
  },
  vpn_suspected: {
    label_vi: 'Nghi VPN',
    description_vi: 'IP của bạn trùng pattern VPN — yêu cầu kết nối trực tiếp',
    severity: 'danger',
    icon: 'shield-half-outline',
  },
};

// Severity rank for picking PRIMARY flag in mobile fail modal (higher = worse)
export const SEVERITY_RANK: Record<RiskFlagSeverity, number> = {
  success: 0,
  info: 1,
  warning: 2,
  danger: 3,
};

export function pickPrimaryFlag(flags: string[]): string | null {
  if (!flags?.length) return null;
  return [...flags].sort((a, b) => {
    const ra = SEVERITY_RANK[RISK_FLAGS[a]?.severity ?? 'info'] ?? 1;
    const rb = SEVERITY_RANK[RISK_FLAGS[b]?.severity ?? 'info'] ?? 1;
    return rb - ra;
  })[0];
}
```

## RiskFlagChip component (Portal standalone)

```typescript
// apps/portal/src/app/shared/components/risk-flag-chip.component.ts
@Component({
  selector: 'app-risk-flag-chip',
  standalone: true,
  imports: [IonChip, IonIcon, IonLabel, IonPopover, IonContent, IonText],
  template: `
    @if (def(); as d) {
    <ion-chip [color]="d.severity" [id]="popId" button>
      <ion-icon [name]="d.icon"></ion-icon>
      <ion-label>{{ d.label_vi }}</ion-label>
    </ion-chip>
    <ion-popover [trigger]="popId" triggerAction="hover" side="top">
      <ng-template>
        <ion-content class="ion-padding">
          <ion-text>{{ d.description_vi }}</ion-text>
        </ion-content>
      </ng-template>
    </ion-popover>
    } @else {
    <ion-chip color="medium"
      ><ion-label>{{ flag }}</ion-label></ion-chip
    >
    }
  `,
})
export class RiskFlagChipComponent {
  @Input({ required: true }) flag!: string;
  readonly popId = `rfc-${Math.random().toString(36).slice(2, 9)}`;
  readonly def = computed(() => RISK_FLAGS[this.flag]);
}
```

`triggerAction="hover"` works on desktop; on mobile/touch falls back to tap-to-show (Ionic default).

## Anomaly page navigation

- Branch row → `[routerLink]="['/dashboard/branch', b.branch_id]"` + `detail="true"` (existing route).
- Employee row → `[routerLink]="['/employees', e.employee_id]"` + `detail="true"` (existing route).
- Device row stays as count badge (no `/employees/:id/devices` route exists; out of scope to add).

## Mobile fail modal

`showFailDialog(flags, distance)` already exists in [home.page.ts:206-207]. Refactor:

```typescript
async showFailDialog(flags: string[], distance: number | null): Promise<void> {
  const primary = pickPrimaryFlag(flags);
  const primaryDef = primary ? RISK_FLAGS[primary] : null;
  const secondary = flags.filter(f => f !== primary).map(f => RISK_FLAGS[f]?.label_vi ?? f);

  const message = primaryDef
    ? `${primaryDef.description_vi}${distance != null ? ` (cách ${distance}m)` : ''}` +
      (secondary.length ? `\n\nKhác: ${secondary.join(', ')}` : '')
    : 'Check-in không hợp lệ';

  await this.alertCtrl.create({
    header: 'Không thể chấm công',
    subHeader: primaryDef?.label_vi,
    message,
    buttons: ['OK'],
  }).then(a => a.present());
}
```

## README — anti-fraud strategy section

```md
## Anti-fraud strategy

Smart Attendance dùng 3 lớp validation cho mỗi check-in/out:

1. **GPS geofence** — so sánh vị trí client với polygon/center-radius của chi nhánh, có ngưỡng độ chính xác (≤50m high, ≤200m moderate, > rejected).
2. **WiFi signature** — match BSSID (MAC) hoặc SSID với danh sách đã đăng ký của chi nhánh; BSSID match trọng số cao hơn SSID match.
3. **Device fingerprint** — UUID per device lưu Preferences, đối chiếu với `employee_devices.is_trusted`.

Mỗi attempt sinh `risk_flags` (xem `libs/shared/constants/risk-flags.ts`) → `Trust Score 0-100` (logic ở `libs/shared/utils/trust-score.ts`). Score < 40 = suspicious (báo manager); 40-69 = review; ≥ 70 = trusted (auto approve).
```

## Decisions — recommendations

| #   | Câu hỏi                                   | Recommend                                                                                   | Alt                                                        |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Map mini hiển thị vị trí                  | **Skip — Option C** (text khoảng cách + GPS coords)                                         | Leaflet (+~150KB), Google Static (cần API key + data leak) |
| 2   | Risk flag map: shared lib hay duplicate   | **Shared `libs/shared/constants/risk-flags.ts`** — single source of truth, zero import cost | Duplicate per app — drift risk                             |
| 3   | Tooltip: ion-popover vs HTML `title`      | **`ion-popover` với `triggerAction="hover"`** — Ionic native, mobile-friendly fallback      | HTML `title` — không support touch                         |
| 4   | Anomaly click navigation: route hay modal | **Route navigation** (existing `/dashboard/branch/:id`, `/employees/:id`)                   | Modal preview — extra component, redundant                 |
| 5   | Mobile fail modal layout                  | **Highlight 1 PRIMARY flag (severity-rank đầu)** + secondary inline                         | Show all flags equal — overwhelming                        |
| 6   | Severity color scheme                     | **4 levels** (success/info/warning/danger) match Ionic palette + trust-score precedent      | 3 levels — mất nuance positive flags                       |
| 7   | Failed events timeline layout             | **Giữ nguyên expanded** (không collapse) — UX consistent với T-013                          | Collapsed by default — extra click                         |
| 8   | Trust Score breakdown UI                  | **Badge only** (defer breakdown) — score đã hiển thị + flags là breakdown                   | Tooltip with weight per flag — scope creep                 |
| 9   | Risk flag icon                            | **ionicons standard** (location, wifi, warning, shield) — đã có dep                         | Custom emoji/SVG — UI inconsistency                        |
| 10  | Anti-fraud README section                 | **Add — 3 short paragraphs** (3-layer + flag→score mapping pointer)                         | Skip — docs/spec.md đủ                                     |

## Extra decisions

- **D-extra-1**: `RiskFlagChipComponent` placement: `apps/portal/src/app/shared/components/` (new dir, mirror existing `shared/types/`). Reuse pattern T-013.
- **D-extra-2**: Mobile error-toast.util.ts: REPLACE local `FLAG_MESSAGES` with shared `RISK_FLAGS[f].description_vi`. Distance template `(cách ${m}m)` sinh tại site (mobile home.page).
- **D-extra-3**: Branch dashboard `risk_flags` field từ T-015 trả về string[] — RiskFlagChipComponent render từng flag, độ rộng giới hạn bằng wrapper flex-wrap.
- **D-extra-4**: Unknown flag (BE thêm flag mới mà FE chưa update map) → fallback `<ion-chip color="medium">` với raw flag string. Không break UI.
- **D-extra-5**: Device row trong anomalies page giữ chỉ count badge (không link). Lý do: `/employees/:id/devices` route chưa tồn tại — không tạo route mới trong T-017 polish.

## Risk

| Risk                                                                                   | Mitigation                                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shared `RISK_FLAGS` map drift khi BE thêm flag                                         | TypeScript `Record<string, …>` cho phép missing key → fallback chip. Spec note: BE thêm flag = update shared map cùng PR      |
| ion-popover hover không trigger trên touch                                             | Ionic auto-fallback to tap; verify trong mobile smoke                                                                         |
| Random `popId` collision                                                               | `Math.random().toString(36).slice(2,9)` ≈ 7 chars base36 = 78B options, collision negligible cho ≤20 chips/page               |
| Anomaly route navigation cho branch outside manager scope                              | Route guard tại `/dashboard/branch/:id` đã enforce (T-015) — 404 nếu manager click branch không thuộc scope                   |
| README modify conflict với CLAUDE.md "no new docs"                                     | README đã tồn tại — modify chứ không tạo mới                                                                                  |
| Mobile fail modal text quá dài → overflow                                              | message dùng `\n\n` separator + Ionic alert tự scroll                                                                         |
| Tooltip text không escape XSS                                                          | Angular template binding tự sanitize                                                                                          |
| Backward compat: existing `error-toast.util.ts` callers gọi `flagMessage(f, distance)` | Giữ wrapper function `flagMessage(flag, distance)` returning shared description + distance suffix; chỉ refactor INTERNAL impl |

## Testing

- **Unit** (libs/shared/constants/risk-flags.spec.ts):
  - All 12 flag keys present in `RISK_FLAGS`
  - `pickPrimaryFlag(['mock_location','accuracy_poor'])` → `'mock_location'` (danger > warning)
  - `pickPrimaryFlag([])` → `null`
  - `pickPrimaryFlag(['unknown_flag'])` → `'unknown_flag'` (fallback severity 'info')
- **Component** (RiskFlagChipComponent.spec.ts):
  - Renders label + icon for known flag
  - Renders fallback chip for unknown flag
- **Manual browser** (REQUIRED per session lessons):
  - Portal: `/attendance/<sessionId>` → kiểm tra severity colors render đúng + popover hover
  - Portal: `/anomalies` → click branch → tới `/dashboard/branch/:id` ; click employee → `/employees/:id`
  - Mobile: trigger fail check-in (e.g., outside geofence) → modal hiển thị primary + secondary

## Execution steps (sau confirm)

1. Tạo `libs/shared/constants/src/lib/risk-flags.ts` + export trong `index.ts`
2. Spec `risk-flags.spec.ts` (4 unit tests)
3. Tạo `apps/portal/src/app/shared/components/risk-flag-chip.component.ts` + spec
4. Modify portal `error-toast.util.ts` — add helper `getFlagLabel(flag)` (re-export shared)
5. Modify portal `session-detail.page.{ts,html}` — replace inline `<ion-chip color="warning">` với `<app-risk-flag-chip>`
6. Modify portal `branch-dashboard.page.{ts,html}` — same replacement
7. Modify portal `anomalies.page.html` — `[routerLink]` cho branch/employee rows + `detail="true"`
8. Modify mobile `error-toast.util.ts` — drop local FLAG_MESSAGES, re-export from shared
9. Modify mobile `home.page.ts` `showFailDialog` — primary/secondary layout
10. Modify README — add "Anti-fraud strategy" section (~3 paragraphs)
11. `pnpm nx reset && pnpm nx test constants && pnpm nx lint portal && pnpm nx lint mobile`
12. Build verify: `pnpm nx build portal && pnpm nx build mobile`
13. Start api + portal → manual browser smoke (3 scenarios)
14. Start mobile (web mode) → smoke fail dialog
15. **Không commit**

## Smoke test (manual browser)

```
PORTAL:
1. /attendance/<sessionId-có-flags>
   → Verify each flag renders với màu đúng severity
   → Hover chip → popover hiển thị description_vi
   → Touch chip (mobile DevTools) → popover open
2. /anomalies (admin)
   → Click row branch trong "Chi nhánh có spike đi trễ"
   → Should navigate to /dashboard/branch/:id
   → Click row employee trong "Nhân viên trust score thấp"
   → Should navigate to /employees/:id
3. Manager login (manager.hcm@demo.com)
   → /dashboard/branch/<HCM-id>
   → "Phiên trust score thấp" hiển thị flags với màu severity (không còn solid warning)

MOBILE (web mode):
4. employee001@demo.com login
   → Force GPS giả (DevTools → Sensors → Custom Location ngoài geofence)
   → Click "Chấm công vào"
   → Fail modal hiển thị PRIMARY (vd "Ngoài vùng — cách 1500m") + secondary chips
5. Mock location = ON (simulator setting)
   → Fail modal PRIMARY = "Giả lập vị trí" (severity rank danger > warning)
```

## Acceptance mapping (T-017 from tasks.md)

- [ ] Risk flags hiển thị bằng tiếng Việt — RISK_FLAGS map ✅
- [ ] Severity color rõ ràng (danger/warning/info/success) — RiskFlagChipComponent ✅
- [ ] Anomaly rows clickable navigate to detail — routerLink ✅
- [ ] Mobile fail modal nói rõ lý do bằng tiếng Việt — pickPrimaryFlag + description_vi ✅
- [ ] Anti-fraud strategy documented — README section ✅

## Review checklist

- [ ] Single source of truth cho flag→VN — shared lib ✅
- [ ] Backward compat (unknown flag fallback) ✅
- [ ] No new dep ✅
- [ ] No schema change ✅
- [ ] No new route ✅
- [ ] All Vietnamese messages ✅
- [ ] Manual smoke 5 scenarios ✅

Reply `OK hết` hoặc `# + extra#` cần đổi → exec.
