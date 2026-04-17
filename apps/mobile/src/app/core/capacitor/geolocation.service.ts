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
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy ?? 999,
        // Capacitor does not expose isMock cross-platform — rely on backend + device.
        isMock: false,
      };
    } catch {
      return null;
    }
  }
}
