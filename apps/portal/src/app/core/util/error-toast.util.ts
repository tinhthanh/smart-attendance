import { ToastController } from '@ionic/angular/standalone';

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'Dữ liệu không hợp lệ',
  INVALID_CREDENTIALS: 'Sai email hoặc mật khẩu',
  CONFLICT: 'Dữ liệu đã tồn tại',
  BRANCH_HAS_ACTIVE_EMPLOYEES: 'Chi nhánh còn nhân viên đang hoạt động',
  EMPLOYEE_CODE_TAKEN: 'Mã nhân viên đã được sử dụng',
  EMAIL_TAKEN: 'Email đã được sử dụng',
  FORBIDDEN: 'Bạn không có quyền truy cập chi nhánh này',
  NOT_FOUND: 'Không tìm thấy',
  TOO_MANY_ATTEMPTS: 'Quá nhiều lần thử, vui lòng chờ 1 phút',
  INVALID_TOKEN: 'Phiên đăng nhập hết hạn',
  ACCOUNT_INACTIVE: 'Tài khoản đã bị khóa',
  ALREADY_CHECKED_IN: 'Đã check-in hôm nay',
  ALREADY_CHECKED_OUT: 'Đã check-out hôm nay',
  NOT_CHECKED_IN_YET: 'Chưa check-in hôm nay',
  INVALID_LOCATION: 'Vị trí không hợp lệ',
  NOT_ASSIGNED_TO_BRANCH: 'Bạn chưa được phân công chi nhánh',
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
