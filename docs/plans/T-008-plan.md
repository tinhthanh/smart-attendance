# T-008 Plan — Trust Score utility (pure function)

> Generated 2026-04-16. Branch: `feature/trust-score-util`. No Nest/Prisma. No new deps.

## Pre-work verify

| Check                                          | Status             |
| ---------------------------------------------- | ------------------ |
| `libs/shared/utils` exists (T-001 placeholder) | ✅ empty lib ready |
| Spec §5.1 + §5.2 + §6 đọc kỹ                   | ✅                 |
| T-008 acceptance: 100% coverage, pure function | ✅                 |

## File structure

```
libs/shared/utils/
├── src/
│   ├── index.ts                       # export
│   └── lib/
│       ├── geo.ts                     # haversineDistance, m
│       ├── geo.spec.ts
│       ├── trust-score.ts             # main — pure function
│       ├── trust-score.spec.ts        # 100% coverage
│       └── trust-score.types.ts       # Input / Output interfaces
```

**Không** tạo `trust-score.const.ts` riêng (Decision #1 — inline constants in same file; spec nhỏ, tra cứu dễ).

## Public API

```typescript
// index.ts exports
export { haversineDistance } from './lib/geo';
export { computeTrustScore, TrustScoreInput, TrustScoreResult, TrustLevel, ValidationMethod, TrustFlag } from './lib/trust-score';

// trust-score.ts
export function computeTrustScore(input: TrustScoreInput): TrustScoreResult;
```

## Input / Output types

```typescript
export interface GpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number; // 0 hoặc undefined → treated as poor (Decision #6)
  isMockLocation: boolean;
}

export interface WifiReading {
  ssid: string;
  bssid: string | null;
}

export interface BranchGeofenceConfig {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface BranchWifiConfigEntry {
  ssid: string;
  bssid: string | null;
  isActive: boolean;
}

export interface DeviceMeta {
  isTrusted: boolean;
  isFirstTime: boolean;
}

export interface HistoryMeta {
  lastEventLat?: number;
  lastEventLng?: number;
  lastEventAt?: Date; // timestamp truyền vào (Decision: input, không Date.now())
  currentEventAt: Date; // ép client pass current time → pure
}

export interface IpMeta {
  isVpnSuspected: boolean;
}

export interface TrustScoreInput {
  gps: GpsReading | null;
  wifi: WifiReading | null;
  branch: {
    geofences: BranchGeofenceConfig[];
    wifiConfigs: BranchWifiConfigEntry[];
  };
  device: DeviceMeta;
  history: HistoryMeta | null;
  ipMeta: IpMeta;
}

export type TrustLevel = 'trusted' | 'review' | 'suspicious';
export type ValidationMethod = 'gps' | 'wifi' | 'gps_wifi' | 'none';
export type TrustFlag = 'gps_in_geofence_high_accuracy' | 'gps_in_geofence_moderate_accuracy' | 'gps_outside_geofence' | 'bssid_match' | 'ssid_only_match' | 'wifi_mismatch' | 'mock_location' | 'accuracy_poor' | 'device_trusted' | 'device_untrusted' | 'impossible_travel' | 'vpn_suspected';

export interface TrustScoreResult {
  score: number; // 0-100 clamped
  level: TrustLevel;
  validationMethod: ValidationMethod;
  flags: TrustFlag[];
  isHardValid: boolean; // gate: if false → backend reject (§6 Lớp 1)
}
```

## Constants (inline — top of trust-score.ts)

```typescript
// Weights — docs/spec.md §5.2
const WEIGHTS = {
  GPS_HIGH_ACCURACY: 40, // accuracy ≤ 20m, inside geofence
  GPS_MODERATE_ACCURACY: 25, // accuracy 20-100m, inside geofence
  BSSID_MATCH: 35,
  SSID_ONLY_MATCH: 15,
  DEVICE_TRUSTED: 15,
  DEVICE_FIRST_TIME: -10,
  MOCK_LOCATION: -50,
  ACCURACY_POOR: -15, // > 100m
  IMPOSSIBLE_TRAVEL: -30,
  VPN_SUSPECTED: -10,
} as const;

// Accuracy boundaries (meters)
const ACCURACY_HIGH_THRESHOLD_M = 20;
const ACCURACY_ACCEPTABLE_THRESHOLD_M = 100;

// Level thresholds
const TRUST_LEVEL_TRUSTED_MIN = 70;
const TRUST_LEVEL_REVIEW_MIN = 40;

// Geo
const EARTH_RADIUS_M = 6_371_000;

// Impossible travel
const IMPOSSIBLE_TRAVEL_SPEED_KMH = 120;
```

## Algorithm flow

```
1. flags = []
2. method = 'none'; score = 0; hardValid = false

3. GPS evaluation:
   if (gps && gps.isMockLocation) {
     score += WEIGHTS.MOCK_LOCATION
     flags += 'mock_location'
     // NOT add GPS weight (Decision #5)
   } else if (gps) {
     inGeo = isInsideGeofence(gps.lat, gps.lng, branch.geofences)
     acc = gps.accuracyMeters ?? Infinity     // undefined → poor (Decision #6)
     if (inGeo && acc <= 20) { score += 40; flags += 'gps_in_geofence_high_accuracy'; method='gps' }
     else if (inGeo && acc <= 100) { score += 25; flags += 'gps_in_geofence_moderate_accuracy'; method='gps' }
     else if (!inGeo) { flags += 'gps_outside_geofence' }

     if (acc > 100) { score += WEIGHTS.ACCURACY_POOR; flags += 'accuracy_poor' }
   }

4. WiFi evaluation:
   m = isWifiMatched(wifi, branch.wifiConfigs)
   if (m === 'bssid_match')   { score += 35; flags += 'bssid_match'; method = method==='gps'?'gps_wifi':'wifi' }
   else if (m === 'ssid_only'){ score += 15; flags += 'ssid_only_match'; method = method==='gps'?'gps_wifi':'wifi' }
   else if (wifi)             { flags += 'wifi_mismatch' }

5. Device:
   if (device.isTrusted) { score += 15; flags += 'device_trusted' }
   else if (device.isFirstTime) { score += -10; flags += 'device_untrusted' }
   // Decision #10: exclusive — trusted HOẶC first_time, not both

6. Impossible travel:
   if (history && history.lastEventLat && history.lastEventAt && gps) {
     speed = distance(history.last, gps) / ((currentAt - lastAt)/3600_000)  km/h
     if (speed > 120) { score += -30; flags += 'impossible_travel' }
   }

7. VPN:
   if (ipMeta.isVpnSuspected) { score += -10; flags += 'vpn_suspected' }

8. Clamp: score = Math.max(0, Math.min(100, score))

9. Hard validation gate (§6 Lớp 1):
   isHardValid = (method !== 'none')
   if (!isHardValid) score = 0   // spec row "không có cả GPS lẫn WiFi hợp lệ → tự động = 0, reject"

10. Level:
    if (score >= 70) 'trusted'
    else if (score >= 40) 'review'
    else 'suspicious'
```

## Test matrix (target 100% branch coverage)

### `haversineDistance`

- `should return 0 when coordinates equal`
- `should return ~111_000m when 1 degree latitude apart at equator`
- `should return positive value regardless of order`
- `should handle antipodal points within tolerance`

### `isInsideGeofence` (private or exported helper)

- inside smaller circle → true
- outside all → false
- inactive geofence ignored → false
- multiple geofences, inside any → true

### `isWifiMatched`

- bssid exact match active config → 'bssid_match'
- bssid null but ssid match → 'ssid_only'
- ssid match but bssid mismatch → 'ssid_only' (fallback)
- no match → 'no_match'
- inactive config ignored

### `computeTrustScore` — scenarios

**GPS-only path**

1. `should return score 40 with method=gps when inside geofence and accuracy=10m`
2. `should return score 25 with method=gps when inside geofence and accuracy=50m`
3. `should add flag gps_outside_geofence with score 0 and hardValid false when gps outside all geofences and no wifi`

**WiFi-only path** 4. `should return score 35 with method=wifi when bssid matches` 5. `should return score 15 with method=wifi when ssid matches but bssid null` 6. `should return score 15 when ssid matches but bssid mismatches` 7. `should flag wifi_mismatch when ssid differs from all configs`

**GPS + WiFi combined** 8. `should set method=gps_wifi and combine scores when both GPS valid and BSSID matches`

**Mock location** 9. `should subtract 50 and skip gps weight when isMockLocation true`

**Accuracy poor** 10. `should add accuracy_poor flag and subtract 15 when accuracy exceeds 100m` 11. `should treat undefined accuracy as poor`

**Device** 12. `should add 15 when device.isTrusted` 13. `should subtract 10 when device.isFirstTime and not trusted` 14. `should prefer trusted over first_time when both flags true` (exclusive — Decision #10)

**Impossible travel** 15. `should subtract 30 and flag impossible_travel when speed exceeds 120 kmh between events` 16. `should not flag when history null` 17. `should not flag when time delta makes speed below 120 kmh`

**VPN** 18. `should subtract 10 and flag vpn_suspected when ipMeta.isVpnSuspected`

**Hard validation gate** 19. `should return score 0 with method=none and hardValid=false when neither GPS nor WiFi validates` 20. `should keep score>0 and hardValid=true when only WiFi validates and GPS outside`

**Clamping** 21. `should clamp to 0 when raw negative sum of flags` 22. `should clamp to 100 when raw above 100`

**Level boundaries** 23. `should level=trusted when score=70` 24. `should level=review when score=69` 25. `should level=review when score=40` 26. `should level=suspicious when score=39`

**Determinism / purity** 27. `should not call Date.now() or have side effects (test by freezing Date)` — (skip if hard to assert; rely on code review)

## Decisions — recommendations

| #   | Câu hỏi                        | Recommend                                                                                           | Alt                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Constants file                 | **Inline** trong trust-score.ts (top block)                                                         | Separate const file — over-split              |
| 2   | Accuracy thresholds            | **≤20m high, 20-100m moderate, >100m poor** (match spec §5.2)                                       | Different                                     |
| 3   | Impossible travel calc         | **`distance / ((currentAt-lastAt)/3_600_000) km/h`** — hours from ms                                | Use minutes                                   |
| 4   | WiFi priority                  | **BSSID first, SSID fallback** — exclusive (không cộng cả 2)                                        | Cộng cả 2 — spec không rõ                     |
| 5   | mock_location + GPS weight     | **Skip GPS weight + apply -50** — mock = distrust GPS fully                                         | Trừ -50 nhưng vẫn cộng GPS (double-counting?) |
| 6   | accuracy undefined/0           | **Treat as `Infinity` → poor**                                                                      | Default 50m — too lenient                     |
| 7   | isHardValid coupled với score? | **KHÔNG** — hardValid chỉ gate bởi validation method ≠ none; score có thể >0 từ wifi_only scenarios | Couple — confusing                            |
| 8   | history null                   | **Skip impossible_travel check** (no flag)                                                          | Flag as missing                               |
| 9   | VPN weight                     | **-10** (match spec)                                                                                | Different                                     |
| 10  | Device trusted vs first_time   | **Exclusive** — trusted=true wins (ignore first_time); else if first_time apply -10                 | Stack both                                    |

## Risk

| Risk                                                                    | Mitigation                                                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Haversine floating point precision edge cases (antipodal)               | Test with tolerance `±1m`                                                                                                               |
| `isMockLocation + inside geofence + good accuracy` — score inconsistent | Decision #5 mock → no GPS weight. Verified in test scenario 9.                                                                          |
| `method = 'gps_wifi'` khi BSSID sai (ssid match fallback)               | `method='gps_wifi'` if BOTH pathways contribute points (spec §5.1 "cả hai đều thỏa"). ssid_only = contributes 15 → method upgraded. OK. |
| Clamp order before level determination                                  | Score clamp happens BEFORE level (step 8 vs 10). Level thresholds apply on clamped score. Correct per spec.                             |
| Test coverage: private helpers `isInsideGeofence` / `isWifiMatched`     | Export as standalone functions (optional) để test riêng. Clean API. Include in `index.ts` exports.                                      |
| Date math với timezone                                                  | All Date comparisons use `.getTime()` ms — timezone-agnostic.                                                                           |
| Input validation (e.g., lat > 90)                                       | **Not** in scope T-008 — caller (service) validates DTO. Pure function trusts input. Document trong JSDoc.                              |

## Execution steps (sau confirm)

1. Tạo `libs/shared/utils/src/lib/geo.ts` + spec
2. Tạo `libs/shared/utils/src/lib/trust-score.types.ts`
3. Tạo `libs/shared/utils/src/lib/trust-score.ts`
4. Tạo `libs/shared/utils/src/lib/trust-score.spec.ts` (~27 test cases)
5. Update `libs/shared/utils/src/index.ts` export
6. `pnpm nx reset && pnpm nx test utils` — verify 100% coverage (`--coverage`)
7. Run all related tests to ensure no regression: `pnpm nx run-many --target=test --all`
8. `git status` — user review
9. **Không commit.**

## Acceptance mapping

- [ ] Pure function (no Nest/Prisma imports, no `Date.now()`) → import check + grep ✅
- [ ] 100% coverage → `--coverage` + threshold in jest config ✅
- [ ] Edge + boundary + all flags → test matrix 27 cases ✅
- [ ] Weights khớp spec §5.2 → unit test assert each weight value ✅

## Review checklist

- [ ] No Nest/Prisma imports ✅
- [ ] No magic number — extracted constants block ✅
- [ ] Earth radius 6_371_000 ✅
- [ ] Score clamp `Math.max(0, Math.min(100, raw))` ✅

Reply `OK hết` hoặc # cần đổi → exec.
