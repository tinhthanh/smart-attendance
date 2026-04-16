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
  setCachedAccessToken,
  setTokens,
} from './token-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  async login(email: string, password: string): Promise<void> {
    const resp = await firstValueFrom(
      this.api.post<LoginResponse>('/auth/login', { email, password })
    );
    await setTokens(resp.data.access_token, resp.data.refresh_token);
    setCachedAccessToken(resp.data.access_token);
    // Fetch full user with employee relation
    await this.fetchMe();
    await this.router.navigate(['/tabs/home']);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout', {}));
    } catch {
      // ignore
    }
    await clearTokens();
    setCachedAccessToken(null);
    this._user.set(null);
    await this.router.navigate(['/login']);
  }

  async refreshToken(): Promise<boolean> {
    const rt = await getRefreshToken();
    if (!rt) return false;
    try {
      const resp = await firstValueFrom(
        this.api.post<RefreshResponse>('/auth/refresh', { refresh_token: rt })
      );
      await setTokens(resp.data.access_token, resp.data.refresh_token);
      setCachedAccessToken(resp.data.access_token);
      return true;
    } catch {
      await clearTokens();
      setCachedAccessToken(null);
      this._user.set(null);
      return false;
    }
  }

  async fetchMe(): Promise<void> {
    try {
      const resp = await firstValueFrom(this.api.get<MeResponse>('/auth/me'));
      this._user.set(resp.data);
    } catch {
      await clearTokens();
      setCachedAccessToken(null);
      this._user.set(null);
    }
  }

  async initFromStorage(): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;
    setCachedAccessToken(token);
    await this.fetchMe();
  }
}
