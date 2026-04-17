import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  LoginResponse,
  MeResponse,
  RefreshResponse,
} from '../../shared/types/auth.types';
import { ApiService } from '../api/api.service';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../storage/token-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  hasRole(role: string) {
    return computed(() => this._user()?.roles.includes(role) ?? false);
  }

  async login(email: string, password: string): Promise<void> {
    const resp = await firstValueFrom(
      this.api.post<LoginResponse>('/auth/login', { email, password })
    );
    setTokens(resp.data.access_token, resp.data.refresh_token);
    this._user.set(resp.data.user);
    await this.router.navigate(['/dashboard']);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout', {}));
    } catch {
      // ignore — token may already be invalid
    }
    clearTokens();
    this._user.set(null);
    await this.router.navigate(['/login']);
  }

  async refreshToken(): Promise<boolean> {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const resp = await firstValueFrom(
        this.api.post<RefreshResponse>('/auth/refresh', {
          refresh_token: rt,
        })
      );
      setTokens(resp.data.access_token, resp.data.refresh_token);
      return true;
    } catch {
      clearTokens();
      this._user.set(null);
      return false;
    }
  }

  async initFromStorage(): Promise<void> {
    const token = getAccessToken();
    if (!token) return;
    try {
      const resp = await firstValueFrom(this.api.get<MeResponse>('/auth/me'));
      this._user.set(resp.data);
    } catch {
      clearTokens();
      this._user.set(null);
    }
  }
}
