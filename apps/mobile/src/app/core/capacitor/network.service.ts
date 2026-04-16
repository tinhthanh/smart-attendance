import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online = signal(true);

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const status = await Network.getStatus();
      this.online.set(status.connected);
      await Network.addListener('networkStatusChange', (s) => {
        this.online.set(s.connected);
      });
    } catch {
      // web fallback — navigator.onLine
      this.online.set(
        typeof navigator === 'undefined' ? true : navigator.onLine
      );
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => this.online.set(true));
        window.addEventListener('offline', () => this.online.set(false));
      }
    }
  }
}
