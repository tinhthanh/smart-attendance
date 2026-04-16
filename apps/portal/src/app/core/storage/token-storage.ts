const KEYS = {
  ACCESS: 'sa_access_token',
  REFRESH: 'sa_refresh_token',
} as const;

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.REFRESH);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(KEYS.ACCESS, access);
  localStorage.setItem(KEYS.REFRESH, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(KEYS.ACCESS);
  localStorage.removeItem(KEYS.REFRESH);
}
