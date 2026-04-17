import { test } from '@playwright/test';

test('Smart Attendance — Mobile Employee Demo', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 10.7769, longitude: 106.7009 });

  // ========================================
  // SCENE 1: Login
  // ========================================
  await page.goto('/login');
  await page.waitForTimeout(2000);

  const emailInput = page.locator('input[type="email"], ion-input[type="email"] input').first();
  const passwordInput = page.locator('input[type="password"], ion-input[type="password"] input').first();
  await emailInput.fill('employee001@demo.com');
  await page.waitForTimeout(500);
  await passwordInput.fill('Employee@123');
  await page.waitForTimeout(500);

  const submitBtn = page.locator('ion-button[type="submit"], button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForURL(/\/(tabs|home)/, { timeout: 15000 });
  await page.waitForTimeout(3000);

  // ========================================
  // SCENE 2: Home — view info + Check-in
  // ========================================
  await page.waitForTimeout(2000);

  // Check In
  const checkInBtn = page.getByText(/check in/i).first();
  if (await checkInBtn.isVisible().catch(() => false)) {
    await checkInBtn.click();
    await page.waitForTimeout(5000);

    // Dismiss alert
    const okBtn = page.locator('ion-alert button, .alert-button').last();
    if (await okBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(2000);
      await okBtn.click();
    }
    await page.waitForTimeout(2000);
  }

  // ========================================
  // SCENE 3: Check-out
  // ========================================
  const checkOutBtn = page.getByText(/check out/i).first();
  if (await checkOutBtn.isVisible().catch(() => false)) {
    await checkOutBtn.click();
    await page.waitForTimeout(5000);

    const okBtn2 = page.locator('ion-alert button, .alert-button').last();
    if (await okBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(2000);
      await okBtn2.click();
    }
    await page.waitForTimeout(2000);
  }

  // ========================================
  // SCENE 4: History tab — scroll entries
  // ========================================
  await page.goto('/tabs/history');
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // ========================================
  // SCENE 5: Trust Score tab
  // ========================================
  await page.goto('/tabs/trust');
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // ========================================
  // SCENE 6: Profile tab → Logout
  // ========================================
  await page.goto('/tabs/profile');
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000);

  // Logout
  const logoutBtn = page.getByText(/đăng xuất|logout/i).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
  }
});
