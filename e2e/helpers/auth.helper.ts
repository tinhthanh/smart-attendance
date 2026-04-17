import { Page } from '@playwright/test';

export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"], input[formcontrolname="email"], ion-input[type="email"] input', { timeout: 10000 });

  const emailInput = page.locator('input[type="email"], input[formcontrolname="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await emailInput.count() === 0) {
    const ionEmail = page.locator('ion-input[type="email"] input').first();
    await ionEmail.fill(email);
    const ionPass = page.locator('ion-input[type="password"] input').first();
    await ionPass.fill(password);
  } else {
    await emailInput.fill(email);
    await passwordInput.fill(password);
  }

  const submitBtn = page.locator('ion-button[type="submit"], button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForURL(/\/(dashboard|tabs)/, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.getByText(/đăng xuất/i).first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await page.waitForTimeout(1000);
  }
}
