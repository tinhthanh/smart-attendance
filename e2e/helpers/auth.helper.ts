import { Page } from '@playwright/test';

/**
 * Dismiss the Vite error overlay if it appears (dev-mode only).
 * This overlay intercepts pointer events and blocks all interactions.
 */
async function dismissViteOverlay(page: Page): Promise<void> {
  const overlay = page.locator('vite-error-overlay');
  if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
    // Remove the overlay via JS so it stops intercepting clicks
    await page.evaluate(() => {
      document.querySelector('vite-error-overlay')?.remove();
    });
    await page.waitForTimeout(300);
  }
}

export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await dismissViteOverlay(page);
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

  await dismissViteOverlay(page);
  const submitBtn = page.locator('ion-button[type="submit"], button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForURL(/\/(dashboard|tabs)/, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

export async function logout(page: Page): Promise<void> {
  await dismissViteOverlay(page);
  const logoutBtn = page.getByText(/\u0111\u0103ng xu\u1ea5t/i).first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await page.waitForTimeout(1000);
  }
}
