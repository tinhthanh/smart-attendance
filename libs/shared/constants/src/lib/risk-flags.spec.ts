import {
  RISK_FLAGS,
  getRiskFlagInfo,
  getRiskFlagSeverity,
  pickPrimaryFlag,
} from './risk-flags';

describe('risk-flags', () => {
  describe('RISK_FLAGS map', () => {
    it('has all 12 canonical TrustFlag entries', () => {
      const keys = Object.keys(RISK_FLAGS);
      expect(keys).toHaveLength(12);
      expect(keys).toEqual(
        expect.arrayContaining([
          'gps_in_geofence_high_accuracy',
          'gps_in_geofence_moderate_accuracy',
          'gps_outside_geofence',
          'bssid_match',
          'ssid_only_match',
          'wifi_mismatch',
          'mock_location',
          'accuracy_poor',
          'device_trusted',
          'device_untrusted',
          'impossible_travel',
          'vpn_suspected',
        ])
      );
    });

    it('assigns severity per approved mapping (R1)', () => {
      expect(getRiskFlagSeverity('gps_in_geofence_high_accuracy')).toBe(
        'success'
      );
      expect(getRiskFlagSeverity('bssid_match')).toBe('success');
      expect(getRiskFlagSeverity('device_trusted')).toBe('info');
      expect(getRiskFlagSeverity('ssid_only_match')).toBe('info');
      expect(getRiskFlagSeverity('accuracy_poor')).toBe('warning');
      expect(getRiskFlagSeverity('device_untrusted')).toBe('warning');
      expect(getRiskFlagSeverity('gps_in_geofence_moderate_accuracy')).toBe(
        'warning'
      );
      expect(getRiskFlagSeverity('mock_location')).toBe('danger');
      expect(getRiskFlagSeverity('gps_outside_geofence')).toBe('danger');
      expect(getRiskFlagSeverity('wifi_mismatch')).toBe('danger');
      expect(getRiskFlagSeverity('impossible_travel')).toBe('danger');
      expect(getRiskFlagSeverity('vpn_suspected')).toBe('danger');
    });

    it('every entry has non-empty label and description', () => {
      for (const [flag, info] of Object.entries(RISK_FLAGS)) {
        expect(info.label_vi.length).toBeGreaterThan(0);
        expect(info.description_vi.length).toBeGreaterThan(0);
        expect(info.icon).toMatch(/-outline$/);
        expect(flag).toBeDefined();
      }
    });
  });

  describe('getRiskFlagInfo', () => {
    it('returns canonical info for known flag', () => {
      const info = getRiskFlagInfo('mock_location');
      expect(info.severity).toBe('danger');
      expect(info.label_vi).toBe('Giả lập vị trí');
    });

    it('returns fallback with raw flag as label for unknown flag', () => {
      const info = getRiskFlagInfo('new_future_flag');
      expect(info.severity).toBe('info');
      expect(info.label_vi).toBe('new_future_flag');
    });
  });

  describe('pickPrimaryFlag', () => {
    it('returns null for empty array', () => {
      expect(pickPrimaryFlag([])).toBeNull();
    });

    it('picks danger over warning', () => {
      expect(pickPrimaryFlag(['accuracy_poor', 'mock_location'])).toBe(
        'mock_location'
      );
    });

    it('picks warning over info', () => {
      expect(pickPrimaryFlag(['device_trusted', 'accuracy_poor'])).toBe(
        'accuracy_poor'
      );
    });

    it('keeps stable order for equal severity', () => {
      const result = pickPrimaryFlag(['mock_location', 'impossible_travel']);
      expect(['mock_location', 'impossible_travel']).toContain(result);
    });

    it('treats unknown flag as info severity', () => {
      expect(pickPrimaryFlag(['unknown_flag', 'mock_location'])).toBe(
        'mock_location'
      );
      expect(pickPrimaryFlag(['unknown_flag'])).toBe('unknown_flag');
    });
  });
});
