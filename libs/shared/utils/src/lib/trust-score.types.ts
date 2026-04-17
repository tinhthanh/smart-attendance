export interface GpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
  isMockLocation: boolean;
}

export interface WifiReading {
  ssid: string;
  bssid: string | null;
}

export interface BranchGeofenceConfig {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface BranchWifiConfigEntry {
  ssid: string;
  bssid: string | null;
  isActive: boolean;
}

export interface DeviceMeta {
  isTrusted: boolean;
  isFirstTime: boolean;
}

export interface HistoryMeta {
  lastEventLat?: number;
  lastEventLng?: number;
  lastEventAt?: Date | number;
  currentEventAt: Date | number;
}

export interface IpMeta {
  isVpnSuspected: boolean;
}

export interface TrustScoreInput {
  gps: GpsReading | null;
  wifi: WifiReading | null;
  branch: {
    geofences: BranchGeofenceConfig[];
    wifiConfigs: BranchWifiConfigEntry[];
  };
  device: DeviceMeta;
  history: HistoryMeta | null;
  ipMeta: IpMeta;
}

export type TrustLevel = 'trusted' | 'review' | 'suspicious';

export type ValidationMethod = 'gps' | 'wifi' | 'gps_wifi' | 'none';

export type TrustFlag =
  | 'gps_in_geofence_high_accuracy'
  | 'gps_in_geofence_moderate_accuracy'
  | 'gps_outside_geofence'
  | 'bssid_match'
  | 'ssid_only_match'
  | 'wifi_mismatch'
  | 'mock_location'
  | 'accuracy_poor'
  | 'device_trusted'
  | 'device_untrusted'
  | 'impossible_travel'
  | 'vpn_suspected';

export interface TrustScoreResult {
  score: number;
  level: TrustLevel;
  validationMethod: ValidationMethod;
  flags: TrustFlag[];
  isHardValid: boolean;
}

export type WifiMatchResult = 'bssid_match' | 'ssid_only' | 'no_match';
