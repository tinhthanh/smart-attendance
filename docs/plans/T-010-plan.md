# T-010 Plan — Portal login + auth flow

> Generated 2026-04-16. Branch: `feature/portal-login`. Day 3 start — first frontend task.

## Pre-work verify

| Check                                                                       | Status            |
| --------------------------------------------------------------------------- | ----------------- |
| `apps/portal` exists (Angular 20 standalone + Ionic 8 deps installed T-001) | ✅                |
| `provideIonicAngular()` NOT yet configured in `app.config.ts`               | ⚠️ needs adding   |
| Ionic CSS imports NOT yet in `styles.scss`                                  | ⚠️ needs adding   |
| Backend API running: `/auth/login`, `/refresh`, `/logout`, `/me` (T-005)    | ✅                |
| 3 test accounts seeded (T-003)                                              | ✅                |
| `nx-welcome` boilerplate present                                            | ✅ will remove    |
| No `environment.ts` files                                                   | ⚠️ needs creating |

## No backend changes. No new deps (Ionic + Angular already installed).

Ionic 8 + Angular 20 deps from T-001: `@ionic/angular@8.8.3`, `@ionic/core@8.8.3`, `ionicons@7.4.0`.

## File structure

```
apps/portal/src/
├── app/
│   ├── app.config.ts              # MODIFY — add provideIonicAngular, provideHttpClient, provideRouter
│   ├── app.routes.ts              # MODIFY — login, dashboard, redirect
│   ├── app.ts                     # MODIFY — ion-app wrapper, remove nx-welcome
│   ├── app.html                   # MODIFY — ion-app > ion-router-outlet
│   ├── app.scss                   # MODIFY — minor
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.service.ts         # Signal-based: currentUser, isAuthenticated, hasRole
│   │   │   ├── auth.interceptor.ts     # Functional interceptor: Bearer + 401 refresh queue
│   │   │   └── auth.guard.ts           # canActivateFn
│   │   ├── api/
│   │   │   └── api.service.ts          # HttpClient wrapper with baseUrl
│   │   └── storage/
│   │       └── token-storage.ts        # localStorage constants + helpers
│   ├── pages/
│   │   ├── login/
│   │   │   ├── login.page.ts           # Standalone component
│   │   │   └── login.page.html         # Ionic form
│   │   └── dashboard/
│   │       ├── dashboard.page.ts       # Standalone placeholder
│   │       └── dashboard.page.html
│   └── shared/
│       └── types/
│           └── auth.types.ts           # LoginResponse, User, etc. (FE-only, no lib import)
├── environments/
│   ├── environment.ts              # apiUrl: '/api/v1' (proxied)
│   └── environment.prod.ts        # apiUrl placeholder
├── styles.scss                    # MODIFY — add Ionic CSS imports
└── proxy.conf.json                # Dev proxy → localhost:3000
```

## Ionic setup (missing from T-001)

T-001 generated Angular app but did NOT wire Ionic. Need:

1. **`app.config.ts`**: add `provideIonicAngular({ mode: 'md' })`, `provideHttpClient(withInterceptors([authInterceptor]))`, `provideRouter(appRoutes)`
2. **`styles.scss`**: add Ionic core CSS imports:
   ```scss
   @import '@ionic/angular/css/core.css';
   @import '@ionic/angular/css/normalize.css';
   @import '@ionic/angular/css/structure.css';
   @import '@ionic/angular/css/typography.css';
   @import '@ionic/angular/css/display.css';
   @import '@ionic/angular/css/padding.css';
   @import '@ionic/angular/css/float-elements.css';
   @import '@ionic/angular/css/text-alignment.css';
   @import '@ionic/angular/css/text-transformation.css';
   @import '@ionic/angular/css/flex-utils.css';
   @import 'ionicons/dist/css/ionicons.min.css';
   ```
3. **`app.html`**: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`
4. **`app.ts`**: import `IonApp, IonRouterOutlet` standalone; remove `NxWelcome`

## Auth flow — implementation design

### Token storage

```typescript
const KEYS = { ACCESS: 'sa_access_token', REFRESH: 'sa_refresh_token' };
export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(KEYS.ACCESS, access);
  localStorage.setItem(KEYS.REFRESH, refresh);
}
export function clearTokens() {
  localStorage.removeItem(KEYS.ACCESS);
  localStorage.removeItem(KEYS.REFRESH);
}
```

### AuthService (Signal-based)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<User | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly hasRole = (role: string) => computed(() => this._user()?.roles.includes(role) ?? false);

  async login(email: string, password: string): Promise<void> {
    const resp = await firstValueFrom(api.post<LoginResponse>('/auth/login', {email, password}));
    setTokens(resp.data.access_token, resp.data.refresh_token);
    this._user.set(resp.data.user);
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(api.post('/auth/logout', {})); } catch { /* ignore */ }
    clearTokens(); this._user.set(null); router.navigate(['/login']);
  }

  async refreshToken(): Promise<boolean> { ... }

  async initFromStorage(): Promise<void> {
    const token = getAccessToken();
    if (!token) return;
    try { const resp = await firstValueFrom(api.get<{data: User}>('/auth/me')); this._user.set(resp.data); }
    catch { clearTokens(); }
  }
}
```

### Interceptor (functional, Angular 17+)

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getAccessToken();
  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/auth/refresh')) {
        return handleRefreshAndRetry(req, next); // queue + deduplicate
      }
      return throwError(() => err);
    })
  );
};
```

**401 queue pattern**: shared `isRefreshing` flag + `BehaviorSubject<string|null>` to queue concurrent requests until refresh resolves, then replay with new token.

### Guard (functional)

```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
```

### Proxy config

```json
// apps/portal/proxy.conf.json
{ "/api": { "target": "http://localhost:3000", "secure": false } }
```

Wire via `project.json` serve target: `"proxyConfig": "apps/portal/proxy.conf.json"`.

## Login page

```html
<ion-content class="ion-padding">
  <div class="login-container">
    <ion-card>
      <ion-card-header>
        <ion-card-title>Smart Attendance</ion-card-title>
        <ion-card-subtitle>Đăng nhập</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <ion-item>
            <ion-input label="Email" type="email" formControlName="email" placeholder="admin@demo.com" />
          </ion-item>
          <ion-item>
            <ion-input label="Mật khẩu" type="password" formControlName="password" />
          </ion-item>
          <ion-button expand="block" type="submit" [disabled]="form.invalid || loading()">
            <ion-spinner *ngIf="loading()" name="crescent" />
            {{ loading() ? '' : 'Đăng nhập' }}
          </ion-button>
        </form>
      </ion-card-content>
    </ion-card>
  </div>
</ion-content>
```

Error display: `ion-toast` via `ToastController`. Vietnamese message: "Sai email hoặc mật khẩu" for 401, "Quá nhiều lần thử" for 429, "Lỗi hệ thống" fallback.

## Decisions — recommendations

| #   | Câu hỏi                          | Recommend                                                                                               | Alt                                              |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Auth state: Signal vs Observable | **Signal** (`signal<User\|null>`) — Angular 20 native, simpler than BehaviorSubject                     | Observable (rxjs heavy)                          |
| 2   | Token storage                    | **localStorage** — persists tabs + restarts; portal is admin tool, not public kiosk                     | sessionStorage — per-tab                         |
| 3   | Dev API URL                      | **Proxy config** (`proxy.conf.json`) — no CORS, clean `fetch('/api/v1/...')`                            | Hardcode `http://localhost:3000` — CORS required |
| 4   | Login error display              | **ion-toast** (3s auto-dismiss, non-blocking) + inline ion-text for validation                          | Inline only (form real estate limited)           |
| 5   | Interceptor style                | **Functional** `HttpInterceptorFn` (Angular 17+, provideHttpClient(withInterceptors([fn])))             | Class-based HttpInterceptor — legacy pattern     |
| 6   | Guard style                      | **Functional** `canActivateFn` (inject + compute)                                                       | Class CanActivate — verbose                      |
| 7   | Remove nx-welcome                | **Yes** — replace with ion-app shell                                                                    | Keep — confusing                                 |
| 8   | Form type                        | **Reactive** (`FormGroup` + `Validators`) — explicit validation, testable                               | Template-driven — less control                   |
| 9   | Auto-refresh on init             | **Yes** — `APP_INITIALIZER` or `app.ts ngOnInit`: if stored token → call `/me` → populate user or clear | Skip — user must re-login every refresh          |
| 10  | Logout confirm dialog            | **No confirm** — just POST /logout + clear + redirect. Admin portal = fast switch.                      | Confirm — too many clicks                        |

## Smoke test (manual)

1. `pnpm nx serve portal` (proxy active) + `pnpm nx serve api` (separate terminal)
2. Open `http://localhost:4200`
3. Redirected to `/login` (guard)
4. Enter `admin@demo.com` / `Admin@123` → submit
5. Redirected to `/dashboard`, shows "Quản trị viên" + roles
6. Refresh page → still on dashboard (auto-refresh from storage)
7. Click logout → redirected /login, localStorage cleared
8. Enter wrong password → toast "Sai email hoặc mật khẩu"
9. DevTools > Application > localStorage: verify `sa_access_token` + `sa_refresh_token` present after login, gone after logout

## Risk

| Risk                                                       | Mitigation                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ionic CSS not imported → ion-\* components render as empty | Explicit CSS imports in styles.scss. Smoke test step 3-4 verifies.                                               |
| `provideIonicAngular` import error with Angular 20         | Ionic 8.8.3 peer `@angular/core >= 16` — should work. Test with `nx serve portal`.                               |
| Proxy config not picked up                                 | Wire `proxyConfig` in `project.json` serve target. Verify with network tab.                                      |
| 401 refresh loop (expired refresh token)                   | Interceptor: skip refresh for `/auth/refresh` URL. On refresh fail → clearTokens + navigate /login (break loop). |
| Multiple tabs open → refresh race condition                | Accepted for MVP. Solution: BroadcastChannel API or shared lock — defer.                                         |
| localStorage XSS risk                                      | Accepted for admin portal MVP. Production: httpOnly cookie + CSRF. Document.                                     |

## Execution steps (sau confirm)

1. Create `environments/environment.ts` + `environment.prod.ts`
2. Create `proxy.conf.json` + wire in `project.json`
3. Wire Ionic in `app.config.ts` (provideIonicAngular + provideHttpClient)
4. Add Ionic CSS imports to `styles.scss`
5. Rewrite `app.ts` + `app.html` (ion-app shell, remove nx-welcome)
6. Create `core/storage/token-storage.ts`
7. Create `core/api/api.service.ts`
8. Create `core/auth/auth.service.ts` (signals)
9. Create `core/auth/auth.interceptor.ts` (functional)
10. Create `core/auth/auth.guard.ts` (functional)
11. Create `shared/types/auth.types.ts`
12. Create `pages/login/login.page.ts` + `.html`
13. Create `pages/dashboard/dashboard.page.ts` + `.html`
14. Update `app.routes.ts` (lazy load login + dashboard)
15. `pnpm nx serve portal` — verify Ionic renders + login works
16. Smoke test 9 steps
17. `git status` — user review
18. **Không commit.**

## Acceptance mapping (docs/tasks.md T-010)

- [ ] Login admin@demo.com → dashboard → smoke 4-5 ✅
- [ ] Refresh page keeps session → smoke 6 (auto-refresh from stored token + /me call) ✅
- [ ] Token expire → auto refresh + retry → interceptor logic (smoke: manually expire in DevTools) ✅
- [ ] Logout → clear + redirect → smoke 7 ✅
- [ ] Sai password → toast Vietnamese → smoke 8 ✅

Reply `OK hết` hoặc # cần đổi → exec.
