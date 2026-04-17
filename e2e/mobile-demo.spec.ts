import { test } from '@playwright/test';

/**
 * Helper: click a tab button by its label text.
 */
async function clickTab(page: import('@playwright/test').Page, label: RegExp) {
  const tab = page.locator('ion-tab-button').filter({ hasText: label });
  await tab.click();
  await page.waitForTimeout(1500);
}

/**
 * Helper: dismiss any visible Ionic alert by clicking its last button.
 */
async function dismissAlert(page: import('@playwright/test').Page) {
  // Try multiple selectors for Ionic alert buttons
  const alertBtn = page.getByRole('button', {
    name: /ok|\u0111\u00e3 hi\u1ec3u|close/i,
  });
  if (await alertBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.waitForTimeout(1500);
    await alertBtn.click();
    await page.waitForTimeout(1500);
  }
}

test('Smart Attendance \u2014 Mobile Employee Demo', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 10.7769, longitude: 106.7009 });

  // ========================================
  // SCENE 1: Login
  // ========================================
  await page.goto('/login');
  await page.waitForTimeout(2000);

  const emailInput = page
    .locator('input[type="email"], ion-input[type="email"] input')
    .first();
  const passwordInput = page
    .locator('input[type="password"], ion-input[type="password"] input')
    .first();
  await emailInput.fill('employee001@demo.com');
  await page.waitForTimeout(500);
  await passwordInput.fill('Employee@123');
  await page.waitForTimeout(500);

  const submitBtn = page
    .locator('ion-button[type="submit"], button[type="submit"]')
    .first();
  await submitBtn.click();
  await page.waitForURL(/\/(tabs|home)/, { timeout: 15000 });
  await page.waitForTimeout(3000);

  // ========================================
  // SCENE 2: Home \u2014 view info + Check-in
  // ========================================
  await page.waitForTimeout(2000);

  // Check In
  const checkInBtn = page.locator('.btn-checkin');
  if (await checkInBtn.isVisible().catch(() => false)) {
    await checkInBtn.click();
    await page.waitForTimeout(6000);
    await dismissAlert(page);
    await page.waitForTimeout(3000);
  }

  // ========================================
  // SCENE 3: Check-out
  // ========================================
  const checkOutBtn = page.locator('.btn-checkout');
  if (await checkOutBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await checkOutBtn.click();
    await page.waitForTimeout(6000);
    await dismissAlert(page);
    await page.waitForTimeout(3000);
  }

  // ========================================
  // SCENE 4: History tab \u2014 click tab button
  // ========================================
  await clickTab(page, /l\u1ecbch s\u1eed|history/i);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // ========================================
  // SCENE 5: Profile tab \u2192 Logout
  // ========================================
  await clickTab(page, /t\u00f4i|profile/i);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000);

  // Logout
  const logoutBtn = page.getByText(/\u0111\u0103ng xu\u1ea5t|logout/i).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
  }
});
