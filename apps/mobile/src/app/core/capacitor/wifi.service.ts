import { Injectable } from '@angular/core';

/**
 * WiFi reading stub.
 *
 * No viable @capacitor community plugin exists for Capacitor 8 (verified
 * 2026-04-16 via npm registry search — `@capacitor-community/wifi` 404,
 * `capacitor-wifi@0.0.1` abandoned). GPS-only path still satisfies backend
 * hard-validation gate via geofence match — trust score will cap around 55
 * (review level) for valid check-ins. Accepted limitation per spec §5.2.
 */
export interface WifiReading {
  ssid: string;
  bssid: string | null;
}

@Injectable({ providedIn: 'root' })
export class WifiService {
  async read(): Promise<WifiReading | null> {
    return null;
  }
}
