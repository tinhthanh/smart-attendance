import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.helper';

test('Smart Attendance — Portal Full Demo', async ({ page }) => {
  // ========================================
  // PART 1: ADMIN — Full system walkthrough
  // ========================================

  // 1.1 Login Admin
  await loginAs(page, 'admin@demo.com', 'Admin@123');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.waitForTimeout(2000);

  // 1.2 Dashboard — KPIs + Charts
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // 1.3 Click menu "Chi nhánh"
  await page.goto('/branches');
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // Click first branch → detail
  const branch1 = page.locator('ion-item, [class*="card"], [class*="item"], tr').first();
  if (await branch1.isVisible().catch(() => false)) {
    await branch1.click();
    await page.waitForTimeout(2500);
    // Scroll detail page
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1500);
  }

  // 1.4 Back to branches → go to Employees
  await page.goto('/employees');
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1500);

  // Click first employee → detail
  const emp1 = page.locator('ion-item, [class*="card"], [class*="item"], tr').first();
  if (await emp1.isVisible().catch(() => false)) {
    await emp1.click();
    await page.waitForTimeout(2500);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1500);
  }

  // 1.5 Go to Attendance
  await page.goto('/attendance');
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // Click first session → detail with events timeline
  const session1 = page.locator('ion-item, [class*="card"], [class*="item"], tr').first();
  if (await session1.isVisible().catch(() => false)) {
    await session1.click();
    await page.waitForTimeout(2500);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1500);
  }

  // 1.6 Back to attendance → Export CSV
  await page.goto('/attendance');
  await page.waitForTimeout(2000);
  const exportBtn = page.getByText(/xuất csv|export/i).first();
  if (await exportBtn.isVisible().catch(() => false)) {
    await exportBtn.click();
    await page.waitForTimeout(5000);
    // Close export modal if present
    const closeBtn = page.locator('ion-button, button').filter({ hasText: /đóng|close|ok/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // 1.7 Go to Anomaly Dashboard
  await page.goto('/anomalies');
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // 1.8 Logout Admin
  await logout(page);
  await page.waitForTimeout(2000);

  // ========================================
  // PART 2: MANAGER — Scoped branch view
  // ========================================

  // 2.1 Login Manager
  await loginAs(page, 'manager.hcm@demo.com', 'Manager@123');
  await page.waitForTimeout(3000);

  // 2.2 Auto-redirect → Branch Dashboard
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // 2.3 Branches — scoped (only HCM-Q1 + badge)
  await page.goto('/branches');
  await page.waitForTimeout(2500);

  // 2.4 Employees — scoped
  await page.goto('/employees');
  await page.waitForTimeout(2500);

  // 2.5 Attendance — scoped sessions
  await page.goto('/attendance');
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // 2.6 Anomalies — scoped
  await page.goto('/anomalies');
  await page.waitForTimeout(2500);

  // 2.7 Logout Manager
  await logout(page);
  await page.waitForTimeout(1500);
});
