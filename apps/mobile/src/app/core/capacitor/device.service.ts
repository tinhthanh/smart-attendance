import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

const FP_KEY = 'sa_device_fp';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  async getFingerprint(): Promise<string> {
    try {
      const id = await Device.getId();
      if (id?.identifier && id.identifier.length >= 8) return id.identifier;
    } catch {
      // fall through
    }
    // Web / unavailable — persistent UUID in Preferences
    try {
      const { value } = await Preferences.get({ key: FP_KEY });
      if (value) return value;
      const uuid = crypto.randomUUID();
      await Preferences.set({ key: FP_KEY, value: uuid });
      return uuid;
    } catch {
      return 'web-' + crypto.randomUUID();
    }
  }

  async getPlatform(): Promise<'ios' | 'android' | 'web'> {
    try {
      const info = await Device.getInfo();
      return info.platform;
    } catch {
      return 'web';
    }
  }

  async getDeviceName(): Promise<string | undefined> {
    try {
      const info = await Device.getInfo();
      return info.name ?? info.model ?? undefined;
    } catch {
      return undefined;
    }
  }

  async getAppVersion(): Promise<string> {
    try {
      const info = await App.getInfo();
      return info.version;
    } catch {
      return '1.0.0-web';
    }
  }
}
