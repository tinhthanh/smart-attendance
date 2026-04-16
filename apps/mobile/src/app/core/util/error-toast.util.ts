import { ToastController } from '@ionic/angular/standalone';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Sai email hoặc mật khẩu',
  ACCOUNT_INACTIVE: 'Tài khoản đã bị khóa',
  VALIDATION_FAILED: 'Dữ liệu không hợp lệ',
  TOO_MANY_ATTEMPTS: 'Quá nhiều lần thử, vui lòng chờ 1 phút',
  ALREADY_CHECKED_IN: 'Bạn đã check-in hôm nay',
  ALREADY_CHECKED_OUT: 'Bạn đã check-out hôm nay',
  NOT_CHECKED_IN_YET: 'Bạn chưa check-in hôm nay',
  INVALID_LOCATION: 'Vị trí không hợp lệ',
  NOT_ASSIGNED_TO_BRANCH: 'Bạn chưa được phân công chi nhánh',
  INVALID_TOKEN: 'Phiên đăng nhập hết hạn',
  FORBIDDEN: 'Bạn không có quyền',
};

const FLAG_MESSAGES: Record<string, (ctx: { distance?: number }) => string> = {
  gps_outside_geofence: (c) =>
    `Bạn ở xa chi nhánh ${c.distance != null ? c.distance + 'm' : ''}`,
  wifi_mismatch: () => 'WiFi không phải của công ty',
  mock_location: () => 'Vui lòng tắt chế độ giả lập vị trí',
  accuracy_poor: () => 'Tín hiệu GPS yếu — hãy ra chỗ thoáng',
  impossible_travel: () => 'Di chuyển bất thường — liên hệ quản lý',
  device_untrusted: () => 'Thiết bị lần đầu sử dụng',
  vpn_suspected: () => 'Phát hiện VPN — vui lòng tắt',
};

const FALLBACK = 'Lỗi hệ thống, vui lòng thử lại';

export function errorMessage(err: unknown): string {
  const code = (err as { error?: { error?: { code?: string } } })?.error?.error
    ?.code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const message = (err as { error?: { error?: { message?: string } } })?.error
    ?.error?.message;
  return message || FALLBACK;
}

export function flagMessage(flag: string, distance?: number): string {
  const fn = FLAG_MESSAGES[flag];
  return fn ? fn({ distance }) : flag;
}

export async function showErrorToast(
  toast: ToastController,
  err: unknown
): Promise<void> {
  const t = await toast.create({
    message: errorMessage(err),
    duration: 3000,
    color: 'danger',
    position: 'top',
  });
  await t.present();
}

export async function showSuccessToast(
  toast: ToastController,
  message: string
): Promise<void> {
  const t = await toast.create({
    message,
    duration: 2000,
    color: 'success',
    position: 'top',
  });
  await t.present();
}
