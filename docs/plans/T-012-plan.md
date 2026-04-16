# T-012 Plan — Mobile check-in/out screen

> Generated 2026-04-16. Branch: `feature/mobile-checkin`. 90' AI — hardest frontend task.

## Pre-work verify

| Check                                                                                               | Status |
| --------------------------------------------------------------------------------------------------- | ------ |
| `apps/mobile` exists (T-001 Angular + Ionic standalone)                                             | ✅     |
| Capacitor 8.3 deps installed (core, cli, app, haptics)                                              | ✅     |
| `capacitor.config.ts` present (T-001)                                                               | ✅     |
| Backend `/attendance/check-in`, `/check-out`, `/me` ready (T-009)                                   | ✅     |
| T-010 portal pattern (signal auth, interceptor, guard) — **reference only** (mobile has own copies) | ✅     |
| iOS/Android platforms NOT added (defer T-018) — web mode enough for T-012 acceptance                | ✅     |

## WiFi plugin research — Decision #1 impact

Verified via `npm view`:

- ❌ `@capacitor-community/wifi` — **does not exist** (404)
- ❌ `@digaus/capacitor-wifi` — 404
- ⚠️ `capacitor-wifi@0.0.1` — single author, 1 release, abandoned, Capacitor 2 era
- ⚠️ `cordova-plugin-wifi-manager@0.5.0` — Cordova (not Capacitor), Android only

**Conclusion**: no viable Capacitor 8 WiFi plugin exists. Recommend **skip WiFi plugin, GPS-only** for MVP. Backend trust score still works (BSSID_MATCH weight 35 → lose; but GPS_HIGH_ACCURACY 40 + DEVICE_TRUSTED 15 = 55 = review level). Document limitation in code comment.

## Pinned plugin versions (verified)

| Package                  | Version | Source                  |
| ------------------------ | ------- | ----------------------- |
| `@capacitor/geolocation` | `8.2.0` | official                |
| `@capacitor/device`      | `8.0.2` | official                |
| `@capacitor/network`     | `8.0.1` | official                |
| `@capacitor/preferences` | `8.0.1` | official (Decision #10) |

No WiFi plugin installed. WifiService stub always returns `null`.

## File structure

```
apps/mobile/src/app/
├── app.config.ts                       # MODIFY — provideIonicAngular + provideHttpClient + APP_INITIALIZER
├── app.ts + app.html                   # MODIFY — ion-app wrapper
├── app.routes.ts                       # MODIFY — tabs + login route
├── core/
│   ├── auth/
│   │   ├── auth.service.ts             # Signal-based (copy pattern from portal)
│   │   ├── auth.interceptor.ts         # 401 queue + refresh
│   │   ├── auth.guard.ts               # canActivateFn
│   │   └── token-storage.ts            # Capacitor Preferences (Decision #10)
│   ├── api/
│   │   └── api.service.ts
│   ├── capacitor/
│   │   ├── geolocation.service.ts      # wrap Geolocation.getCurrentPosition
│   │   ├── wifi.service.ts             # stub — always returns null, documented
│   │   ├── device.service.ts           # fingerprint via Device.getId()
│   │   └── network.service.ts          # online$ signal
│   ├── checkin/
│   │   └── checkin.api.service.ts      # POST /check-in, /check-out, GET /me
│   └── util/
│       └── error-toast.util.ts
├── shared/types/
│   └── checkin.types.ts
├── layout/
│   └── tabs.layout.ts                  # ion-tabs bottom nav (Home/History/Profile)
├── pages/
│   ├── login/login.page.{ts,html}     # copy pattern from portal
│   ├── home/home.page.{ts,html}        # main check-in screen
│   ├── history/history.page.{ts,html} # 30-day history
│   └── profile/profile.page.{ts,html} # user info + logout
├── environments/environment.ts        # apiUrl dev
└── proxy.conf.json                    # dev proxy → :3000
```

## Capacitor permission strings

### iOS — `ios/App/App/Info.plist` (when `cap add ios` at T-018)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Smart Attendance cần vị trí của bạn để xác thực check-in tại chi nhánh được phân công.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<!-- Android 13+ NEARBY_WIFI_DEVICES — defer, not used in MVP (no wifi plugin) -->
```

Document these permissions in `apps/mobile/README.md` for T-018. **Do NOT add platform files in T-012** — out of scope.

## Permission flow

```typescript
// GeolocationService
async getPosition(): Promise<GpsReading | null> {
  const status = await Geolocation.checkPermissions();
  if (status.location !== 'granted') {
    const result = await Geolocation.requestPermissions();
    if (result.location !== 'granted') {
      return null; // caller shows permission UI
    }
  }
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10_000,
  });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyMeters: pos.coords.accuracy,
  };
}
```

Home page:

- On "Check in" tap → try getPosition()
- If null → show `ion-alert` "Cần quyền vị trí để chấm công" + button "Mở Cài đặt" (no-op in web mode; native uses `App.openSettings()` at T-018)
- If got → POST /check-in, show result modal

## Home screen state machine

| State               | UI                                                    |
| ------------------- | ----------------------------------------------------- |
| Loading /me         | Spinner                                               |
| Not assigned        | Text "Chưa được phân công chi nhánh"                  |
| Not checked in      | Big button "CHECK IN"                                 |
| Checked in, not out | Text "Đã check-in lúc HH:mm" + button "CHECK OUT"     |
| Checked out         | Text "Đã chấm công đầy đủ hôm nay" + trust score card |
| Offline             | Banner "Mất kết nối — kiểm tra mạng" + disable button |

After submit:

- `ion-modal` result: icon + title + score gauge
  - Score ≥70: green checkmark "Check-in thành công" + xanh badge
  - Score 40-69: yellow "Check-in thành công nhưng cần xem xét" + vàng badge
  - Score <40: red X "Check-in không hợp lệ" + mô tả flag (thân thiện tiếng Việt)
- Haptics success via `@capacitor/haptics` on success

## Check-in payload

```typescript
await api.post('/attendance/check-in', {
  latitude: gps.lat,
  longitude: gps.lng,
  accuracy_meters: Math.round(gps.accuracyMeters),
  // ssid + bssid omitted (wifi plugin not available — see wifi.service.ts comment)
  device_fingerprint: await device.getFingerprint(),
  platform: Capacitor.getPlatform(), // 'ios' | 'android' | 'web'
  device_name: await device.getName(),
  app_version: appInfo.version,
  is_mock_location: gps.isMock ?? false,
});
```

## Flag-to-VN message helper

```typescript
const FLAG_MESSAGES: Record<string, (ctx: { distance?: number }) => string> = {
  gps_outside_geofence: (c) => `Bạn ở xa chi nhánh ${c.distance ?? '?'}m`,
  wifi_mismatch: () => 'WiFi không phải của công ty',
  mock_location: () => 'Vui lòng tắt chế độ giả lập vị trí',
  accuracy_poor: () => 'Tín hiệu GPS yếu — hãy ra chỗ thoáng',
  impossible_travel: () => 'Di chuyển bất thường — vui lòng liên hệ quản lý',
  device_untrusted: () => 'Thiết bị lần đầu sử dụng — cần quản lý xác nhận',
};
```

Result modal iterates `flags[]`, displays as list of `ion-item`.

## History page

- Load `/attendance/me?date_from=last_30d` on init
- `ion-refresher` pull-to-refresh → resets page=1 + reload
- Each item: `ion-item` with date, times, worked_minutes, status chip, trust_score badge
- Tap item → open detail modal (events list from `/attendance/sessions/:id` if role allows — employee only sees own)

## Tabs layout

```html
<ion-tabs>
  <ion-tab-bar slot="bottom">
    <ion-tab-button tab="home"><ion-icon name="home" /><ion-label>Home</ion-label></ion-tab-button>
    <ion-tab-button tab="history"><ion-icon name="time" /><ion-label>Lịch sử</ion-label></ion-tab-button>
    <ion-tab-button tab="profile"><ion-icon name="person" /><ion-label>Tôi</ion-label></ion-tab-button>
  </ion-tab-bar>
</ion-tabs>
```

Route nesting: `/` (login) | `/(tabs)/home`, `/(tabs)/history`, `/(tabs)/profile`.

## Decisions — recommendations

| #   | Câu hỏi                        | Recommend                                                                                                                                                                               | Alt                                                     |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | WiFi plugin                    | **Skip** — no viable Capacitor 8 plugin exists. Stub `WifiService.read()` returns `null` with TODO comment. Backend trust score path still works via GPS + device. Document limitation. | Install `capacitor-wifi@0.0.1` — abandoned, will break  |
| 2   | Device fingerprint             | **`Capacitor Device.getId().identifier`** — stable per-install on native, stable for browser session on web (random UUID for web first-use, stored in Preferences)                      | Custom UUID always — lose native stability              |
| 3   | Navigation                     | **ion-tabs bottom nav** (Home / History / Profile) — mobile-native pattern                                                                                                              | Side menu — wastes space on phone                       |
| 4   | Permission denied UX           | **`ion-alert` dialog** with "Mở Cài đặt" button (native) or "Hiểu rồi" (web)                                                                                                            | Inline banner — less prominent                          |
| 5   | Mock location detection        | **Trust device `isMock` flag + backend decides** — spec §6 explicit. No Capacitor plugin for reliable detection anyway                                                                  | Force-fetch via native plugin — overkill                |
| 6   | Confirm before check-in submit | **Submit immediately** when user taps big button — UX fast-path. GPS collected as part of button handler.                                                                               | Confirm dialog — extra friction                         |
| 7   | Pull-to-refresh History        | **Reset page=1** + reload (full refresh)                                                                                                                                                | Incremental append — complex, low value for 30-day list |
| 8   | Trust Score visualization      | **Color badge** (xanh/vàng/đỏ text + icon)                                                                                                                                              | Gauge meter — extra SVG library                         |
| 9   | App version source             | **`App.getInfo().version`** via `@capacitor/app`                                                                                                                                        | Hardcode — drifts from native                           |
| 10  | Session persistence            | **`@capacitor/preferences`** — secure storage on native (Keychain iOS, EncryptedSharedPreferences Android) + localStorage fallback on web                                               | localStorage only — not secure native                   |

## Extra decisions

- **D-extra-1**: `@capacitor/preferences` Storage API is **async** — auth.service init is async. Use `APP_INITIALIZER` to block boot until tokens loaded, else guards may redirect `/login` before user state ready.
- **D-extra-2**: Device fingerprint stored in Preferences with key `sa_device_fp` — generated v4 UUID on first run (web + native). Native also has stable `Device.getId()` — prefer that, fallback to UUID.
- **D-extra-3**: `Network.addListener('networkStatusChange')` → signal `online`. Disable check-in button when offline (don't enqueue — defer per CLAUDE.md anti-complexity).
- **D-extra-4**: Web mode mock coords: accept any coords user/tester sets via browser DevTools Geolocation emulation. No in-app mock picker.

## Smoke test (web mode — sufficient per acceptance)

1. `pnpm nx serve api` + `pnpm nx serve mobile`
2. Browser DevTools → Sensors → Geolocation: set HCM-Q1 coords (10.7766, 106.7009)
3. Login `employee001@demo.com` / `Employee@123` → tab Home
4. Click "CHECK IN" → permission prompt (web) → allow → POST /check-in → result modal "Check-in thành công" + score badge ≥40 (GPS-only = 40, device_untrusted first-run = -10 → 30, but GPS path = hard valid → review level)
5. Status updates to "Đã check-in lúc HH:mm" + CHECK OUT button
6. Click CHECK OUT → similar flow → "Đã chấm công đầy đủ hôm nay"
7. Set Geolocation to Hanoi (21.0285, 105.8542) → login fresh employee → CHECK IN → result modal red "Bạn ở xa chi nhánh 1143km"
8. Disable network in DevTools → banner "Mất kết nối" + button disabled
9. Tab History → list sessions → pull-to-refresh updates

## Risk

| Risk                                                                                          | Mitigation                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Web browser Geolocation API requires HTTPS in production — dev `localhost` is OK              | Document in README                                                                                          |
| Capacitor Preferences fails on web with restrictive browsers                                  | Fallback to localStorage inside token-storage.ts try/catch                                                  |
| `App.getInfo()` throws on web                                                                 | Catch + fallback to `'1.0.0-web'`                                                                           |
| Device.getId() returns same string across web sessions (uses navigator)                       | Generate UUID + store — stable per-browser per-install                                                      |
| Bundle size > 1MB budget                                                                      | Bump budget as T-011 did, document                                                                          |
| No WiFi → trust score max 40 GPS + 15 trusted = 55 (review) → user confused why always yellow | Tell backend (future) to relax threshold for GPS-only, or document as known limitation. Out of T-012 scope. |
| CSS/Ionic not imported (same bug as T-010 if not wired)                                       | Include Ionic CSS imports in `styles.scss` — step 1 of exec                                                 |
| Proxy config missing                                                                          | Copy pattern from T-010 portal                                                                              |

## Execution steps (sau confirm)

1. Install plugins: `pnpm add -w @capacitor/geolocation@8.2.0 @capacitor/device@8.0.2 @capacitor/network@8.0.1 @capacitor/preferences@8.0.1`
2. Wire Ionic in `apps/mobile/src/app/app.config.ts` (provideIonicAngular, provideHttpClient, APP_INITIALIZER)
3. Ionic CSS imports in `apps/mobile/src/styles.scss`
4. `environments/environment.ts` + `proxy.conf.json` + wire in `project.json`
5. Create `core/` services (auth, api, capacitor wrappers, checkin)
6. Create `layout/tabs.layout.ts`
7. Create pages (login, home, history, profile)
8. Update `app.routes.ts` — tabs + login + authGuard
9. Remove `nx-welcome` boilerplate
10. `pnpm nx reset && pnpm nx test mobile && pnpm nx lint mobile`
11. `pnpm nx serve mobile` → browser test 9 scenarios
12. `git status` — user review
13. **Không commit** — user verifies + commits

## Acceptance mapping

- [ ] Build `npx cap sync` no error (web mode OK) → test via `pnpm nx build mobile` ✅
- [ ] Run on browser với mock GPS → smoke 2-7 ✅
- [ ] Check-in success → backend creates session → smoke 4 + DB verify ✅
- [ ] Trust score color badge → smoke 4 (review/suspicious) ✅
- [ ] Permission denied → UI rõ ràng no crash → smoke step (deny web permission prompt) ✅

## Review checklist

- [ ] Plugin version PIN (no `^`) ✅ pinned 8.2.0 / 8.0.2 / 8.0.1
- [ ] Permission strings documented for Info.plist + AndroidManifest → README section ✅
- [ ] No sensitive data in query string — POST body only ✅
- [ ] Trust score badge has `aria-label` — e.g., `aria-label="Điểm tin cậy 85 — tin cậy"` ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
