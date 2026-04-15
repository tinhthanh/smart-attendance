import {
  AttendanceEventStatus,
  AttendanceEventType,
  AttendanceSessionStatus,
  PrismaClient,
  RoleCode,
  ValidationMethod,
} from '@prisma/client';
import {
  ATTENDANCE_DAYS,
  BRANCHES,
  DEFAULT_SCHEDULE,
  TEST_ACCOUNTS,
  generateEmployees,
  patternFor,
} from './seed/data';
import {
  branchId,
  checkInTime,
  checkOutTime,
  departmentId,
  employeeId,
  eventId,
  geofenceId,
  hashPassword,
  minutesBetween,
  roleId,
  scheduleAssignmentId,
  scheduleId,
  sessionId,
  userId,
  wifiConfigId,
  workDate,
  workDateString,
} from './seed/helpers';

const prisma = new PrismaClient();

async function seedRoles() {
  const roles: { code: RoleCode; name: string }[] = [
    { code: RoleCode.admin, name: 'Administrator' },
    { code: RoleCode.manager, name: 'Branch Manager' },
    { code: RoleCode.employee, name: 'Employee' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: { id: roleId(r.code), code: r.code, name: r.name },
      update: { name: r.name },
    });
  }
}

async function seedBranches() {
  for (const b of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: b.code },
      create: {
        id: branchId(b.code),
        code: b.code,
        name: b.name,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
      },
      update: {
        name: b.name,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
      },
    });

    for (const dept of b.departments) {
      await prisma.department.upsert({
        where: { branchId_name: { branchId: branchId(b.code), name: dept } },
        create: {
          id: departmentId(b.code, dept),
          branchId: branchId(b.code),
          name: dept,
        },
        update: {},
      });
    }

    for (const w of b.wifi) {
      await prisma.branchWifiConfig.upsert({
        where: { id: wifiConfigId(b.code, w.bssid) },
        create: {
          id: wifiConfigId(b.code, w.bssid),
          branchId: branchId(b.code),
          ssid: w.ssid,
          bssid: w.bssid,
          priority: 0,
        },
        update: { ssid: w.ssid, priority: 0 },
      });
    }

    await prisma.branchGeofence.upsert({
      where: { id: geofenceId(b.code, b.geofenceName) },
      create: {
        id: geofenceId(b.code, b.geofenceName),
        branchId: branchId(b.code),
        name: b.geofenceName,
        centerLat: b.latitude,
        centerLng: b.longitude,
        radiusMeters: b.geofenceRadiusMeters,
      },
      update: {
        name: b.geofenceName,
        centerLat: b.latitude,
        centerLng: b.longitude,
        radiusMeters: b.geofenceRadiusMeters,
      },
    });
  }
}

async function seedSchedule() {
  await prisma.workSchedule.upsert({
    where: { id: scheduleId(DEFAULT_SCHEDULE.name) },
    create: {
      id: scheduleId(DEFAULT_SCHEDULE.name),
      name: DEFAULT_SCHEDULE.name,
      startTime: DEFAULT_SCHEDULE.startTime,
      endTime: DEFAULT_SCHEDULE.endTime,
      graceMinutes: DEFAULT_SCHEDULE.graceMinutes,
      overtimeAfterMinutes: DEFAULT_SCHEDULE.overtimeAfterMinutes,
      workdays: [...DEFAULT_SCHEDULE.workdays],
    },
    update: {
      startTime: DEFAULT_SCHEDULE.startTime,
      endTime: DEFAULT_SCHEDULE.endTime,
      graceMinutes: DEFAULT_SCHEDULE.graceMinutes,
      overtimeAfterMinutes: DEFAULT_SCHEDULE.overtimeAfterMinutes,
      workdays: [...DEFAULT_SCHEDULE.workdays],
    },
  });
}

async function seedUsersAndEmployees() {
  const generated = generateEmployees();

  // Replace first 2 of HCM-Q1 with the named test accounts (manager + employee001).
  const manager = TEST_ACCOUNTS.find((a) => a.roleCode === 'manager')!;
  const emp001 = TEST_ACCOUNTS.find((a) => a.roleCode === 'employee')!;
  const hcmEmployees = generated.filter((e) => e.branchCode === 'HCM-Q1');
  hcmEmployees[0].employeeCode = manager.employeeCode!;
  hcmEmployees[0].email = manager.email;
  hcmEmployees[0].fullName = manager.fullName;
  hcmEmployees[0].departmentName = manager.departmentName!;
  hcmEmployees[1].employeeCode = emp001.employeeCode!;
  hcmEmployees[1].email = emp001.email;
  hcmEmployees[1].fullName = emp001.fullName;
  hcmEmployees[1].departmentName = emp001.departmentName!;

  // Admin: standalone user, no employee record.
  const adminAccount = TEST_ACCOUNTS.find((a) => a.roleCode === 'admin')!;
  await prisma.user.upsert({
    where: { email: adminAccount.email },
    create: {
      id: userId(adminAccount.email),
      email: adminAccount.email,
      passwordHash: hashPassword(adminAccount.password),
      fullName: adminAccount.fullName,
    },
    update: {
      passwordHash: hashPassword(adminAccount.password),
      fullName: adminAccount.fullName,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: userId(adminAccount.email), roleId: roleId('admin') },
    },
    create: { userId: userId(adminAccount.email), roleId: roleId('admin') },
    update: {},
  });

  // All 30 employees (including manager.hcm + employee001).
  for (const emp of generated) {
    const isManager = emp.employeeCode === manager.employeeCode;
    const isNamedTest = emp.email === manager.email || emp.email === emp001.email;
    const password = isManager
      ? manager.password
      : emp.email === emp001.email
        ? emp001.password
        : 'Demo@123456';

    await prisma.user.upsert({
      where: { email: emp.email },
      create: {
        id: userId(emp.email),
        email: emp.email,
        passwordHash: hashPassword(password),
        fullName: emp.fullName,
      },
      update: {
        passwordHash: hashPassword(password),
        fullName: emp.fullName,
      },
    });

    await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      create: {
        id: employeeId(emp.employeeCode),
        userId: userId(emp.email),
        employeeCode: emp.employeeCode,
        primaryBranchId: branchId(emp.branchCode),
        departmentId: departmentId(emp.branchCode, emp.departmentName),
      },
      update: {
        primaryBranchId: branchId(emp.branchCode),
        departmentId: departmentId(emp.branchCode, emp.departmentName),
      },
    });

    const role: RoleCode = isManager ? RoleCode.manager : RoleCode.employee;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: userId(emp.email), roleId: roleId(role) } },
      create: { userId: userId(emp.email), roleId: roleId(role) },
      update: {},
    });

    await prisma.workScheduleAssignment.upsert({
      where: { id: scheduleAssignmentId(emp.employeeCode, DEFAULT_SCHEDULE.name) },
      create: {
        id: scheduleAssignmentId(emp.employeeCode, DEFAULT_SCHEDULE.name),
        employeeId: employeeId(emp.employeeCode),
        scheduleId: scheduleId(DEFAULT_SCHEDULE.name),
        effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
      },
      update: { effectiveFrom: new Date(Date.UTC(2026, 0, 1)) },
    });

    void isNamedTest;
  }

  return generated;
}

async function seedAttendance(
  employees: { employeeCode: string; branchCode: string }[],
  baseDate: Date,
) {
  for (let idx = 0; idx < employees.length; idx++) {
    const emp = employees[idx];
    for (let dayOffset = 1; dayOffset <= ATTENDANCE_DAYS; dayOffset++) {
      const pattern = patternFor(idx, dayOffset);
      const wdStr = workDateString(baseDate, dayOffset);
      const wd = workDate(baseDate, dayOffset);
      const sid = sessionId(emp.employeeCode, wdStr);

      if (pattern.status === 'absent') {
        await prisma.attendanceSession.upsert({
          where: { employeeId_workDate: { employeeId: employeeId(emp.employeeCode), workDate: wd } },
          create: {
            id: sid,
            employeeId: employeeId(emp.employeeCode),
            branchId: branchId(emp.branchCode),
            workDate: wd,
            status: AttendanceSessionStatus.absent,
            trustScore: null,
          },
          update: {
            status: AttendanceSessionStatus.absent,
            trustScore: null,
            checkInAt: null,
            checkOutAt: null,
            workedMinutes: null,
          },
        });
        continue;
      }

      const ci = checkInTime(wd, pattern.checkInOffsetMin);
      const co = checkOutTime(wd, pattern.checkOutOffsetMin);
      const worked = minutesBetween(ci, co);
      const status =
        pattern.status === 'late'
          ? AttendanceSessionStatus.late
          : pattern.status === 'early_leave'
            ? AttendanceSessionStatus.early_leave
            : AttendanceSessionStatus.on_time;

      await prisma.attendanceSession.upsert({
        where: { employeeId_workDate: { employeeId: employeeId(emp.employeeCode), workDate: wd } },
        create: {
          id: sid,
          employeeId: employeeId(emp.employeeCode),
          branchId: branchId(emp.branchCode),
          workDate: wd,
          checkInAt: ci,
          checkOutAt: co,
          workedMinutes: worked,
          overtimeMinutes: 0,
          status,
          trustScore: pattern.trustScoreBase,
        },
        update: {
          checkInAt: ci,
          checkOutAt: co,
          workedMinutes: worked,
          overtimeMinutes: 0,
          status,
          trustScore: pattern.trustScoreBase,
        },
      });

      const ciEventId = eventId(emp.employeeCode, wdStr, 'check_in');
      const coEventId = eventId(emp.employeeCode, wdStr, 'check_out');

      await prisma.attendanceEvent.upsert({
        where: { id: ciEventId },
        create: {
          id: ciEventId,
          sessionId: sid,
          employeeId: employeeId(emp.employeeCode),
          branchId: branchId(emp.branchCode),
          eventType: AttendanceEventType.check_in,
          status: AttendanceEventStatus.success,
          validationMethod: ValidationMethod.gps_wifi,
          trustScore: pattern.trustScoreBase,
          createdAt: ci,
          riskFlags: pattern.riskFlags ? pattern.riskFlags : undefined,
        },
        update: {
          trustScore: pattern.trustScoreBase,
          createdAt: ci,
          validationMethod: ValidationMethod.gps_wifi,
          status: AttendanceEventStatus.success,
          riskFlags: pattern.riskFlags ? pattern.riskFlags : undefined,
        },
      });

      await prisma.attendanceEvent.upsert({
        where: { id: coEventId },
        create: {
          id: coEventId,
          sessionId: sid,
          employeeId: employeeId(emp.employeeCode),
          branchId: branchId(emp.branchCode),
          eventType: AttendanceEventType.check_out,
          status: AttendanceEventStatus.success,
          validationMethod: ValidationMethod.gps_wifi,
          trustScore: pattern.trustScoreBase,
          createdAt: co,
        },
        update: {
          trustScore: pattern.trustScoreBase,
          createdAt: co,
          validationMethod: ValidationMethod.gps_wifi,
          status: AttendanceEventStatus.success,
        },
      });
    }
  }
}

async function main() {
  const baseDate = new Date();
  console.log('Seeding roles...');
  await seedRoles();
  console.log('Seeding branches + departments + wifi + geofences...');
  await seedBranches();
  console.log('Seeding work schedule...');
  await seedSchedule();
  console.log('Seeding users + employees + role bindings + schedule assignments...');
  const employees = await seedUsersAndEmployees();
  console.log(`Seeding ${ATTENDANCE_DAYS} days × ${employees.length} employees attendance...`);
  await seedAttendance(employees, baseDate);

  const [roles, branches, depts, users, emps, sessions, events] = await Promise.all([
    prisma.role.count(),
    prisma.branch.count(),
    prisma.department.count(),
    prisma.user.count(),
    prisma.employee.count(),
    prisma.attendanceSession.count(),
    prisma.attendanceEvent.count(),
  ]);
  console.log('--- Seed summary ---');
  console.log(`roles: ${roles}`);
  console.log(`branches: ${branches}`);
  console.log(`departments: ${depts}`);
  console.log(`users: ${users}`);
  console.log(`employees: ${emps}`);
  console.log(`attendance_sessions: ${sessions}`);
  console.log(`attendance_events: ${events}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
