import type { TrustFlag } from '@smart-attendance/shared/utils';

export type RiskFlagSeverity = 'success' | 'info' | 'warning' | 'danger';

export interface RiskFlagInfo {
  label_vi: string;
  description_vi: string;
  severity: RiskFlagSeverity;
  icon: string;
}

export const RISK_FLAGS: Record<TrustFlag, RiskFlagInfo> = {
  gps_in_geofence_high_accuracy: {
    label_vi: 'GPS chính xác',
    description_vi: 'Vị trí trong vùng cho phép, độ chính xác cao',
    severity: 'success',
    icon: 'location-outline',
  },
  bssid_match: {
    label_vi: 'WiFi khớp',
    description_vi: 'Đang kết nối WiFi của chi nhánh (BSSID khớp)',
    severity: 'success',
    icon: 'wifi-outline',
  },
  device_trusted: {
    label_vi: 'Thiết bị tin cậy',
    description_vi: 'Thiết bị đã được xác minh trước đây',
    severity: 'info',
    icon: 'shield-checkmark-outline',
  },
  ssid_only_match: {
    label_vi: 'WiFi gần đúng',
    description_vi: 'Tên WiFi đúng nhưng địa chỉ phần cứng (BSSID) không khớp',
    severity: 'info',
    icon: 'wifi-outline',
  },
  accuracy_poor: {
    label_vi: 'GPS yếu',
    description_vi: 'Sai số GPS quá lớn — vui lòng ra chỗ thoáng',
    severity: 'warning',
    icon: 'alert-circle-outline',
  },
  device_untrusted: {
    label_vi: 'Thiết bị mới',
    description_vi: 'Thiết bị lần đầu sử dụng — đang chờ xác minh',
    severity: 'warning',
    icon: 'help-circle-outline',
  },
  gps_in_geofence_moderate_accuracy: {
    label_vi: 'GPS trung bình',
    description_vi:
      'Vị trí trong vùng nhưng độ chính xác GPS giảm — cần WiFi xác minh thêm',
    severity: 'warning',
    icon: 'location-outline',
  },
  mock_location: {
    label_vi: 'Giả lập vị trí',
    description_vi: 'Phát hiện ứng dụng giả lập GPS — phiên đáng nghi',
    severity: 'danger',
    icon: 'warning-outline',
  },
  gps_outside_geofence: {
    label_vi: 'Ngoài vùng',
    description_vi: 'Vị trí GPS nằm ngoài bán kính cho phép của chi nhánh',
    severity: 'danger',
    icon: 'navigate-circle-outline',
  },
  wifi_mismatch: {
    label_vi: 'WiFi sai',
    description_vi: 'WiFi đang kết nối không phải của công ty',
    severity: 'danger',
    icon: 'wifi-outline',
  },
  impossible_travel: {
    label_vi: 'Di chuyển bất thường',
    description_vi: 'Khoảng cách giữa hai lần check-in vượt vận tốc tối đa',
    severity: 'danger',
    icon: 'flash-outline',
  },
  vpn_suspected: {
    label_vi: 'Nghi VPN',
    description_vi: 'IP của bạn trùng pattern VPN — yêu cầu kết nối trực tiếp',
    severity: 'danger',
    icon: 'shield-half-outline',
  },
};

export const UNKNOWN_FLAG_FALLBACK: RiskFlagInfo = {
  label_vi: '',
  description_vi: 'Cờ bất thường chưa được định nghĩa',
  severity: 'info',
  icon: 'help-outline',
};

const SEVERITY_RANK: Record<RiskFlagSeverity, number> = {
  success: 0,
  info: 1,
  warning: 2,
  danger: 3,
};

export function getRiskFlagInfo(flag: string): RiskFlagInfo {
  const known = (RISK_FLAGS as Record<string, RiskFlagInfo | undefined>)[flag];
  return known ?? { ...UNKNOWN_FLAG_FALLBACK, label_vi: flag };
}

export function getRiskFlagSeverity(flag: string): RiskFlagSeverity {
  return getRiskFlagInfo(flag).severity;
}

export function pickPrimaryFlag(flags: readonly string[]): string | null {
  if (!flags || flags.length === 0) return null;
  return [...flags].sort((a, b) => {
    const ra = SEVERITY_RANK[getRiskFlagSeverity(a)];
    const rb = SEVERITY_RANK[getRiskFlagSeverity(b)];
    return rb - ra;
  })[0];
}
