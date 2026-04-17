import { Preferences } from '@capacitor/preferences';

const KEYS = {
  ACCESS: 'sa_access_token',
  REFRESH: 'sa_refresh_token',
} as const;

export async function getAccessToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: KEYS.ACCESS });
    return value;
  } catch {
    return localStorage.getItem(KEYS.ACCESS);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: KEYS.REFRESH });
    return value;
  } catch {
    return localStorage.getItem(KEYS.REFRESH);
  }
}

export async function setTokens(
  access: string,
  refresh: string
): Promise<void> {
  try {
    await Preferences.set({ key: KEYS.ACCESS, value: access });
    await Preferences.set({ key: KEYS.REFRESH, value: refresh });
  } catch {
    localStorage.setItem(KEYS.ACCESS, access);
    localStorage.setItem(KEYS.REFRESH, refresh);
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await Preferences.remove({ key: KEYS.ACCESS });
    await Preferences.remove({ key: KEYS.REFRESH });
  } catch {
    // ignore
  }
  localStorage.removeItem(KEYS.ACCESS);
  localStorage.removeItem(KEYS.REFRESH);
}

/**
 * Synchronous cached access token for interceptor.
 * Updated from async Preferences call on init + after login/refresh.
 */
let cachedAccess: string | null = null;
export function getCachedAccessToken(): string | null {
  return cachedAccess;
}
export function setCachedAccessToken(token: string | null): void {
  cachedAccess = token;
}
