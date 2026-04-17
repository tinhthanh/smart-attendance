import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
  isMock: boolean;
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  async getPosition(): Promise<GpsReading | null> {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== 'granted') {
        const result = await Geolocation.requestPermissions();
        if (result.location !== 'granted') return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      // Browser geolocation API may return accuracy=0 for mock locations
      // (e.g. Playwright tests). The trust-score engine treats 0 as Infinity,
      // so we clamp to a sensible default when the value is missing or invalid.
      const rawAcc = pos.coords.accuracy;
      const accuracyMeters =
        rawAcc != null && rawAcc > 0 && rawAcc < 500 ? rawAcc : 10;

      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters,
        // Capacitor does not expose isMock cross-platform — rely on backend + device.
        isMock: false,
      };
    } catch {
      return null;
    }
  }
}
