/**
 * Clean today's attendance session for employee001 so e2e test can do fresh check-in.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find employee001
  const emp = await prisma.employee.findFirst({
    where: { employeeCode: 'HCMQ1-EMP-001' },
  });
  if (!emp) {
    console.log('Employee HCMQ1-EMP-001 not found');
    return;
  }
  console.log('Employee:', emp.id, emp.employeeCode);

  // Delete today's events first (FK constraint)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delEvents = await prisma.attendanceEvent.deleteMany({
    where: {
      employeeId: emp.id,
      createdAt: { gte: today },
    },
  });
  console.log('Events deleted:', delEvents.count);

  // Delete today's session
  const delSessions = await prisma.attendanceSession.deleteMany({
    where: {
      employeeId: emp.id,
      workDate: { gte: today },
    },
  });
  console.log('Sessions deleted:', delSessions.count);

  // Also delete any devices created by e2e (untrusted web devices)
  const delDevices = await prisma.employeeDevice.deleteMany({
    where: {
      employeeId: emp.id,
      platform: 'web',
    },
  });
  console.log('Web devices deleted:', delDevices.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
