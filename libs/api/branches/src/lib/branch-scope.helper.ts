import { PrismaService } from '@smart-attendance/api/common';

export interface UserRolesContext {
  id: string;
  roles: string[];
}

export function isAdmin(user: UserRolesContext): boolean {
  return user.roles.includes('admin');
}

export async function getManagerBranchIds(
  prisma: PrismaService,
  userId: string
): Promise<string[]> {
  const today = new Date();
  const emp = await prisma.employee.findFirst({
    where: { userId },
    select: {
      primaryBranchId: true,
      assignments: {
        where: {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        select: { branchId: true },
      },
    },
  });
  if (!emp) return [];
  const ids = new Set<string>([emp.primaryBranchId]);
  emp.assignments.forEach((a) => ids.add(a.branchId));
  return Array.from(ids);
}
