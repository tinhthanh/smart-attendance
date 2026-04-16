import { haversineDistance } from './geo';
import {
  BranchGeofenceConfig,
  BranchWifiConfigEntry,
  TrustFlag,
  TrustLevel,
  TrustScoreInput,
  TrustScoreResult,
  ValidationMethod,
  WifiMatchResult,
  WifiReading,
} from './trust-score.types';

// ===== Weights — docs/spec.md §5.2 =====
const WEIGHTS = {
  GPS_HIGH_ACCURACY: 40,
  GPS_MODERATE_ACCURACY: 25,
  BSSID_MATCH: 35,
  SSID_ONLY_MATCH: 15,
  DEVICE_TRUSTED: 15,
  DEVICE_FIRST_TIME: -10,
  MOCK_LOCATION: -50,
  ACCURACY_POOR: -15,
  IMPOSSIBLE_TRAVEL: -30,
  VPN_SUSPECTED: -10,
} as const;

const ACCURACY_HIGH_THRESHOLD_M = 20;
const ACCURACY_ACCEPTABLE_THRESHOLD_M = 100;
const TRUST_LEVEL_TRUSTED_MIN = 70;
const TRUST_LEVEL_REVIEW_MIN = 40;
const IMPOSSIBLE_TRAVEL_SPEED_KMH = 120;
const MS_PER_HOUR = 3_600_000;

/**
 * Returns true if the coordinate falls inside any **active** geofence.
 * Pure; inactive geofences and empty arrays return false.
 */
export function isInsideGeofence(
  lat: number,
  lng: number,
  geofences: BranchGeofenceConfig[]
): boolean {
  for (const g of geofences) {
    if (!g.isActive) continue;
    const d = haversineDistance(lat, lng, g.centerLat, g.centerLng);
    if (d <= g.radiusMeters) return true;
  }
  return false;
}

/**
 * Match a WiFi reading against active branch configs.
 * Priority: exact BSSID match > SSID-only match > no match.
 * Inactive configs are ignored.
 */
export function isWifiMatched(
  wifi: WifiReading | null,
  configs: BranchWifiConfigEntry[]
): WifiMatchResult {
  if (!wifi) return 'no_match';
  const active = configs.filter((c) => c.isActive);

  if (wifi.bssid) {
    const bssidHit = active.some(
      (c) => c.bssid && c.bssid.toLowerCase() === wifi.bssid!.toLowerCase()
    );
    if (bssidHit) return 'bssid_match';
  }

  const ssidHit = active.some((c) => c.ssid === wifi.ssid);
  if (ssidHit) return 'ssid_only';

  return 'no_match';
}

function toMs(t: Date | number): number {
  return typeof t === 'number' ? t : t.getTime();
}

/**
 * Detect travel speed above threshold between two GPS events.
 * Returns false when history or location missing — caller treats as no flag.
 */
export function detectImpossibleTravel(
  currentLat: number,
  currentLng: number,
  currentAt: Date | number,
  lastLat: number | undefined,
  lastLng: number | undefined,
  lastAt: Date | number | undefined
): boolean {
  if (lastLat === undefined || lastLng === undefined || lastAt === undefined) {
    return false;
  }
  const deltaMs = toMs(currentAt) - toMs(lastAt);
  if (deltaMs <= 0) return false;
  const distanceM = haversineDistance(lastLat, lastLng, currentLat, currentLng);
  const hours = deltaMs / MS_PER_HOUR;
  const kmh = distanceM / 1000 / hours;
  return kmh > IMPOSSIBLE_TRAVEL_SPEED_KMH;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function determineLevel(score: number): TrustLevel {
  if (score >= TRUST_LEVEL_TRUSTED_MIN) return 'trusted';
  if (score >= TRUST_LEVEL_REVIEW_MIN) return 'review';
  return 'suspicious';
}

function upgradeMethod(
  current: ValidationMethod,
  addition: 'gps' | 'wifi'
): ValidationMethod {
  if (current === 'none') return addition;
  return 'gps_wifi';
}

/**
 * Compute attendance trust score and validation result.
 *
 * Pure function — no I/O, no Date.now() (timestamp must be passed via
 * `input.history.currentEventAt`). Weight table and thresholds follow
 * `docs/spec.md §5.2`. Hard-validation gate (§6 Lớp 1) returns
 * `isHardValid = false` with score forced to 0 when neither GPS nor WiFi
 * pathway validates the check-in.
 *
 * @param input - GPS reading, WiFi reading, branch configs, device trust,
 *                recent history for impossible-travel detection, IP meta.
 *                Latitude/longitude bounds are **not** validated — caller
 *                must validate via DTO class-validator before invoking.
 * @returns `{ score, level, validationMethod, flags, isHardValid }` where
 *          `score ∈ [0, 100]`, level thresholds 70/40, flags enumerate all
 *          risk conditions detected.
 *
 * @example
 * const result = computeTrustScore({
 *   gps: { lat: 10.7766, lng: 106.7009, accuracyMeters: 10, isMockLocation: false },
 *   wifi: { ssid: 'Office', bssid: 'aa:bb:cc:dd:ee:ff' },
 *   branch: {
 *     geofences: [{ centerLat: 10.7766, centerLng: 106.7009, radiusMeters: 150, isActive: true }],
 *     wifiConfigs: [{ ssid: 'Office', bssid: 'aa:bb:cc:dd:ee:ff', isActive: true }],
 *   },
 *   device: { isTrusted: true, isFirstTime: false },
 *   history: null,
 *   ipMeta: { isVpnSuspected: false },
 * });
 * // result.score = 90, level = 'trusted', method = 'gps_wifi'
 */
export function computeTrustScore(input: TrustScoreInput): TrustScoreResult {
  const flags: TrustFlag[] = [];
  let score = 0;
  let method: ValidationMethod = 'none';

  // ---------- GPS ----------
  if (input.gps) {
    const { lat, lng, accuracyMeters, isMockLocation } = input.gps;
    const acc = accuracyMeters > 0 ? accuracyMeters : Number.POSITIVE_INFINITY;

    if (isMockLocation) {
      // Decision #5: mock location → apply penalty but skip GPS weight
      score += WEIGHTS.MOCK_LOCATION;
      flags.push('mock_location');
    } else {
      const inGeo = isInsideGeofence(lat, lng, input.branch.geofences);
      if (inGeo && acc <= ACCURACY_HIGH_THRESHOLD_M) {
        score += WEIGHTS.GPS_HIGH_ACCURACY;
        flags.push('gps_in_geofence_high_accuracy');
        method = upgradeMethod(method, 'gps');
      } else if (inGeo && acc <= ACCURACY_ACCEPTABLE_THRESHOLD_M) {
        score += WEIGHTS.GPS_MODERATE_ACCURACY;
        flags.push('gps_in_geofence_moderate_accuracy');
        method = upgradeMethod(method, 'gps');
      } else if (!inGeo) {
        flags.push('gps_outside_geofence');
      }
    }

    if (!isMockLocation && acc > ACCURACY_ACCEPTABLE_THRESHOLD_M) {
      score += WEIGHTS.ACCURACY_POOR;
      flags.push('accuracy_poor');
    }
  }

  // ---------- WiFi ----------
  const wifiResult = isWifiMatched(input.wifi, input.branch.wifiConfigs);
  if (wifiResult === 'bssid_match') {
    score += WEIGHTS.BSSID_MATCH;
    flags.push('bssid_match');
    method = upgradeMethod(method, 'wifi');
  } else if (wifiResult === 'ssid_only') {
    score += WEIGHTS.SSID_ONLY_MATCH;
    flags.push('ssid_only_match');
    method = upgradeMethod(method, 'wifi');
  } else if (input.wifi) {
    flags.push('wifi_mismatch');
  }

  // ---------- Device ----------
  if (input.device.isTrusted) {
    score += WEIGHTS.DEVICE_TRUSTED;
    flags.push('device_trusted');
  } else if (input.device.isFirstTime) {
    score += WEIGHTS.DEVICE_FIRST_TIME;
    flags.push('device_untrusted');
  }

  // ---------- Impossible travel ----------
  if (input.history && input.gps) {
    const traveled = detectImpossibleTravel(
      input.gps.lat,
      input.gps.lng,
      input.history.currentEventAt,
      input.history.lastEventLat,
      input.history.lastEventLng,
      input.history.lastEventAt
    );
    if (traveled) {
      score += WEIGHTS.IMPOSSIBLE_TRAVEL;
      flags.push('impossible_travel');
    }
  }

  // ---------- VPN ----------
  if (input.ipMeta.isVpnSuspected) {
    score += WEIGHTS.VPN_SUSPECTED;
    flags.push('vpn_suspected');
  }

  // ---------- Clamp + Hard validation gate ----------
  const isHardValid = method !== 'none';
  if (!isHardValid) {
    return {
      score: 0,
      level: 'suspicious',
      validationMethod: 'none',
      flags,
      isHardValid: false,
    };
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    level: determineLevel(finalScore),
    validationMethod: method,
    flags,
    isHardValid: true,
  };
}
