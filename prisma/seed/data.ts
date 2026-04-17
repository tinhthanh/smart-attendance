import { Prisma } from '@prisma/client';

export interface BranchSeed {
  code: string;
  name: string;
  address: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  wifi: { ssid: string; bssid: string }[];
  geofenceName: string;
  geofenceRadiusMeters: number;
  departments: string[];
}

export const BRANCHES: BranchSeed[] = [
  {
    code: 'HCM-Q1',
    name: 'Chi nhánh TP.HCM Quận 1',
    address: '123 Lê Lợi, Quận 1, TP.HCM',
    latitude: new Prisma.Decimal('10.7766400'),
    longitude: new Prisma.Decimal('106.7009800'),
    wifi: [
      { ssid: 'SA-HCMQ1-Office', bssid: 'AA:BB:CC:11:22:01' },
      { ssid: 'SA-HCMQ1-Guest', bssid: 'AA:BB:CC:11:22:02' },
    ],
    geofenceName: 'HCM-Q1 Main',
    geofenceRadiusMeters: 150,
    departments: ['Engineering', 'Sales', 'Operations'],
  },
  {
    code: 'HN-HoanKiem',
    name: 'Chi nhánh Hà Nội Hoàn Kiếm',
    address: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
    latitude: new Prisma.Decimal('21.0285000'),
    longitude: new Prisma.Decimal('105.8542000'),
    wifi: [{ ssid: 'SA-HNHK-Office', bssid: 'AA:BB:CC:22:33:01' }],
    geofenceName: 'HN-HoanKiem Main',
    geofenceRadiusMeters: 120,
    departments: ['Engineering', 'Sales', 'Operations'],
  },
  {
    code: 'DN-HaiChau',
    name: 'Chi nhánh Đà Nẵng Hải Châu',
    address: '78 Bạch Đằng, Hải Châu, Đà Nẵng',
    latitude: new Prisma.Decimal('16.0544000'),
    longitude: new Prisma.Decimal('108.2022000'),
    wifi: [
      { ssid: 'SA-DNHC-Office', bssid: 'AA:BB:CC:33:44:01' },
      { ssid: 'SA-DNHC-Guest', bssid: 'AA:BB:CC:33:44:02' },
    ],
    geofenceName: 'DN-HaiChau Main',
    geofenceRadiusMeters: 150,
    departments: ['Engineering', 'Sales', 'Operations'],
  },
];

export const DEFAULT_SCHEDULE = {
  name: 'Standard 8h',
  startTime: '08:00',
  endTime: '17:00',
  graceMinutes: 10,
  overtimeAfterMinutes: 60,
  workdays: [1, 2, 3, 4, 5] as const,
};

export interface TestAccount {
  email: string;
  password: string;
  fullName: string;
  roleCode: 'admin' | 'manager' | 'employee';
  employeeCode?: string;
  branchCode?: string;
  departmentName?: string;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'admin@demo.com',
    password: 'Admin@123',
    fullName: 'Quản trị viên',
    roleCode: 'admin',
  },
  {
    email: 'manager.hcm@demo.com',
    password: 'Manager@123',
    fullName: 'Nguyễn Văn Manager',
    roleCode: 'manager',
    employeeCode: 'HCMQ1-MGR-001',
    branchCode: 'HCM-Q1',
    departmentName: 'Operations',
  },
  {
    email: 'employee001@demo.com',
    password: 'Employee@123',
    fullName: 'Trần Thị Employee',
    roleCode: 'employee',
    employeeCode: 'HCMQ1-EMP-001',
    branchCode: 'HCM-Q1',
    departmentName: 'Engineering',
  },
];

const FIRST_NAMES = [
  'An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hương', 'Khanh', 'Lan',
  'Long', 'Minh', 'Nam', 'Phương', 'Quân', 'Sơn', 'Thảo', 'Tuấn', 'Vy', 'Yến',
];
const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];

export interface GeneratedEmployee {
  employeeCode: string;
  email: string;
  fullName: string;
  branchCode: string;
  departmentName: string;
}

export function generateEmployees(): GeneratedEmployee[] {
  const employees: GeneratedEmployee[] = [];
  let counter = 1;
  for (const branch of BRANCHES) {
    for (let i = 0; i < 10; i++) {
      const first = FIRST_NAMES[(counter * 7) % FIRST_NAMES.length];
      const last = LAST_NAMES[(counter * 3) % LAST_NAMES.length];
      const department = branch.departments[i % branch.departments.length];
      const code = `${branch.code}-EMP-${String(counter).padStart(3, '0')}`;
      employees.push({
        employeeCode: code,
        email: `${code.toLowerCase()}@demo.com`,
        fullName: `${last} ${first}`,
        branchCode: branch.code,
        departmentName: department,
      });
      counter++;
    }
  }
  return employees;
}

export const ATTENDANCE_DAYS = 7;

export interface DayPattern {
  status: 'on_time' | 'late' | 'early_leave' | 'absent';
  checkInOffsetMin: number;
  checkOutOffsetMin: number;
  trustScoreBase: number;
  riskFlags?: string[];
}

export function patternFor(employeeIndex: number, dayOffset: number): DayPattern {
  const hash = (employeeIndex * 31 + dayOffset * 17) % 100;
  if (hash < 70) {
    return {
      status: 'on_time',
      checkInOffsetMin: (hash % 5),
      checkOutOffsetMin: 0,
      trustScoreBase: 85 + (hash % 16),
    };
  }
  if (hash < 85) {
    return {
      status: 'late',
      checkInOffsetMin: 15 + (hash % 20),
      checkOutOffsetMin: 0,
      trustScoreBase: 70 + (hash % 15),
    };
  }
  if (hash < 95) {
    return {
      status: 'early_leave',
      checkInOffsetMin: 0,
      checkOutOffsetMin: -(30 + (hash % 30)),
      trustScoreBase: 60 + (hash % 20),
    };
  }
  return {
    status: 'absent',
    checkInOffsetMin: 0,
    checkOutOffsetMin: 0,
    trustScoreBase: 0,
    riskFlags: ['no_checkin'],
  };
}
