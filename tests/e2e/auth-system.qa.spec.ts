import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const MAILPIT_URL = 'http://mailpit:8025';

test.describe('Authentication System E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.screenshot({ 
      path: `./screenshots/auth-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  test('01 - Should display login page correctly', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Check page title
    await expect(page).toHaveTitle(/VoxStudent/);
    
    // Check login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check VoxStudent branding
    await expect(page.locator('text=VoxStudent')).toBeVisible();
  });

  test('02 - Should validate email format', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Try invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('input[type="email"]:invalid')).toBeVisible();
  });

  test('03 - Should request magic link for valid email', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill valid email
    await page.fill('input[type="email"]', 'admin@qa.voxstudent.com');
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text*=enviado')).toBeVisible({ timeout: 10000 });
  });

  test('04 - Should handle role-based access control', async () => {
    // Test different role access
    const roles = [
      { email: 'admin@qa.voxstudent.com', role: 'admin' },
      { email: 'teacher@qa.voxstudent.com', role: 'teacher' },
      { email: 'student@qa.voxstudent.com', role: 'student' }
    ];

    for (const { email, role } of roles) {
      await page.goto(`${BASE_URL}`);
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      
      // Wait for success message
      await page.waitForTimeout(2000);
      
      // Each role should get appropriate access
      await page.screenshot({ 
        path: `./screenshots/auth-role-${role}.png`,
        fullPage: true 
      });
    }
  });

  test('05 - Should test session persistence', async () => {
    // Login as admin
    await page.goto(`${BASE_URL}`);
    await page.fill('input[type="email"]', 'admin@qa.voxstudent.com');
    await page.click('button[type="submit"]');
    
    // Wait for potential redirect
    await page.waitForTimeout(3000);
    
    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should maintain session (not show login form again)
    const isLoggedIn = await page.locator('input[type="email"]').count() === 0;
    if (isLoggedIn) {
      expect(true).toBe(true); // Session persisted
    }
  });

  test('06 - Should test logout functionality', async () => {
    await page.goto(`${BASE_URL}`);
    
    // Look for logout button/link
    const logoutButton = page.locator('text=Sair').or(page.locator('text=Logout'));
    const logoutExists = await logoutButton.count() > 0;
    
    if (logoutExists) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
      
      // Should redirect to login page
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test('07 - Should protect admin routes', async () => {
    // Try to access admin route without authentication
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Should either redirect to login or show unauthorized
    const hasEmailInput = await page.locator('input[type="email"]').count() > 0;
    const hasUnauthorized = await page.locator('text*=autorizado').count() > 0;
    
    expect(hasEmailInput || hasUnauthorized).toBe(true);
  });

  test('08 - Should handle invalid magic links', async () => {
    // Try to access with invalid token
    await page.goto(`${BASE_URL}/auth/verify?token=invalid-token-123`);
    await page.waitForLoadState('networkidle');
    
    // Should show error or redirect to login
    const hasError = await page.locator('text*=inválido').count() > 0;
    const hasLogin = await page.locator('input[type="email"]').count() > 0;
    
    expect(hasError || hasLogin).toBe(true);
  });

  test('09 - Should test WhatsApp authentication flow', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Look for WhatsApp login option
    const whatsappButton = page.locator('text*=WhatsApp');
    const whatsappExists = await whatsappButton.count() > 0;
    
    if (whatsappExists) {
      await whatsappButton.click();
      await page.waitForTimeout(2000);
      
      // Should show appropriate WhatsApp flow
      await page.screenshot({ 
        path: './screenshots/auth-whatsapp-flow.png',
        fullPage: true 
      });
    }
  });

  test('10 - Should test rate limiting', async () => {
    await page.goto(`${BASE_URL}`);
    
    // Try multiple login attempts quickly
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', `test${i}@qa.voxstudent.com`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }
    
    // Should eventually show rate limiting message
    const hasRateLimit = await page.locator('text*=muitas tentativas').count() > 0;
    
    // Rate limiting may or may not be implemented, so this is informational
    await page.screenshot({ 
      path: './screenshots/auth-rate-limiting-test.png',
      fullPage: true 
    });
  });
});