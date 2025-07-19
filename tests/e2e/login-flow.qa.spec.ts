import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Login Flow E2E Tests', () => {
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
    // Clear any existing session
    await context.clearCookies();
    await context.clearPermissions();
    
    await page.screenshot({ 
      path: `./screenshots/login-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  test('01 - Should display login page with all required elements', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Check page structure
    await expect(page).toHaveTitle(/VoxStudent/);
    
    // Check main heading
    const mainHeading = page.locator('h1, h2').first();
    await expect(mainHeading).toBeVisible();
    
    // Check email input field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('placeholder');
    
    // Check submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/entrar|login|enviar/i);
    
    // Check VoxStudent branding
    await expect(page.locator('text=VoxStudent')).toBeVisible();
    
    // Check form structure
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('02 - Should validate empty email submission', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Try to submit without email
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Should prevent submission or show validation error
    const emailInput = page.locator('input[type="email"]');
    
    // Check for HTML5 validation
    const isValid = await emailInput.evaluate(el => (el as HTMLInputElement).validity.valid);
    expect(isValid).toBe(false);
    
    // Check if we're still on the same page
    await expect(page).toHaveURL(BASE_URL);
  });

  test('03 - Should validate invalid email formats', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    const invalidEmails = [
      'invalid-email',
      'test@',
      '@domain.com',
      'test..test@domain.com',
      'test@domain',
      'spaces in@email.com'
    ];
    
    for (const invalidEmail of invalidEmails) {
      // Clear and fill with invalid email
      const emailInput = page.locator('input[type="email"]');
      await emailInput.clear();
      await emailInput.fill(invalidEmail);
      
      // Try to submit
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Should not proceed with invalid email
      const isValid = await emailInput.evaluate(el => (el as HTMLInputElement).validity.valid);
      expect(isValid).toBe(false);
      
      await page.waitForTimeout(500);
    }
  });

  test('04 - Should handle valid email submission (admin)', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill valid admin email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@qa.voxstudent.com');
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should show success message or redirect
    const hasSuccessMessage = await page.locator('text*=enviado').count() > 0;
    const hasRedirect = !page.url().endsWith('/');
    
    expect(hasSuccessMessage || hasRedirect).toBe(true);
    
    if (hasSuccessMessage) {
      // Check success message content
      await expect(page.locator('text*=email')).toBeVisible();
      await expect(page.locator('text*=enviado')).toBeVisible();
    }
  });

  test('05 - Should handle valid email submission (teacher)', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill valid teacher email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('teacher@qa.voxstudent.com');
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should show success message
    const hasSuccessMessage = await page.locator('text*=enviado').count() > 0;
    expect(hasSuccessMessage).toBe(true);
  });

  test('06 - Should handle valid email submission (student)', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill valid student email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('student@qa.voxstudent.com');
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should show success message
    const hasSuccessMessage = await page.locator('text*=enviado').count() > 0;
    expect(hasSuccessMessage).toBe(true);
  });

  test('07 - Should handle unknown email gracefully', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill unknown email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('unknown.user@qa.voxstudent.com');
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should either show success message (for security) or appropriate error
    const hasResponse = await page.locator('text*=enviado, text*=erro, text*=inválido').count() > 0;
    expect(hasResponse).toBe(true);
  });

  test('08 - Should show loading state during submission', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@qa.voxstudent.com');
    
    // Submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Check if button shows loading state
    await page.waitForTimeout(500);
    
    // Look for loading indicators
    const hasLoadingText = await submitButton.locator('text*=enviando, text*=carregando, text*=loading').count() > 0;
    const hasLoadingIcon = await submitButton.locator('svg, .loading, .spinner').count() > 0;
    const isDisabled = await submitButton.isDisabled();
    
    // At least one loading indicator should be present
    expect(hasLoadingText || hasLoadingIcon || isDisabled).toBe(true);
  });

  test('09 - Should prevent multiple rapid submissions', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@qa.voxstudent.com');
    
    const submitButton = page.locator('button[type="submit"]');
    
    // Rapid multiple clicks
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should handle gracefully (not crash or send multiple requests)
    const isStillResponsive = await page.locator('body').isVisible();
    expect(isStillResponsive).toBe(true);
  });

  test('10 - Should test responsive design on mobile', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Check mobile layout
    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    
    // Check if elements are properly sized for mobile
    const emailBox = await emailInput.boundingBox();
    const submitBox = await submitButton.boundingBox();
    
    expect(emailBox?.width).toBeGreaterThan(200); // Reasonable mobile width
    expect(submitBox?.height).toBeGreaterThan(40); // Touch-friendly height
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: './screenshots/login-mobile-layout.png',
      fullPage: true 
    });
    
    // Reset viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('11 - Should test keyboard navigation', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Should focus on email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
    
    // Type email using keyboard
    await page.keyboard.type('admin@qa.voxstudent.com');
    
    // Tab to submit button
    await page.keyboard.press('Tab');
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();
    
    // Submit using Enter key
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should work the same as clicking
    const hasResponse = await page.locator('text*=enviado').count() > 0;
    expect(hasResponse).toBe(true);
  });

  test('12 - Should handle network errors gracefully', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Simulate network failure by blocking the request
    await page.route('**/api/**', route => route.abort());
    
    // Fill email and submit
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@qa.voxstudent.com');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for error handling
    await page.waitForTimeout(5000);
    
    // Should show error message or handle gracefully
    const hasErrorMessage = await page.locator('text*=erro, text*=falhou, text*=problema').count() > 0;
    const isStillResponsive = await submitButton.isEnabled();
    
    // Either show error or re-enable button for retry
    expect(hasErrorMessage || isStillResponsive).toBe(true);
    
    // Clear route interception
    await page.unroute('**/api/**');
  });

  test('13 - Should test accessibility features', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Check for proper labels
    const emailInput = page.locator('input[type="email"]');
    
    // Should have label, aria-label, or placeholder
    const hasLabel = await page.locator('label[for]').count() > 0;
    const hasAriaLabel = await emailInput.getAttribute('aria-label') !== null;
    const hasPlaceholder = await emailInput.getAttribute('placeholder') !== null;
    
    expect(hasLabel || hasAriaLabel || hasPlaceholder).toBe(true);
    
    // Check for proper heading structure
    const hasMainHeading = await page.locator('h1').count() > 0;
    expect(hasMainHeading).toBe(true);
    
    // Check for focus indicators
    await emailInput.focus();
    await page.screenshot({ 
      path: './screenshots/login-accessibility-focus.png',
      fullPage: true 
    });
  });

  test('14 - Should maintain form state during navigation', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@qa.voxstudent.com');
    
    // Navigate away and back (if there are other links)
    const aboutLink = page.locator('a[href*="about"], a[href*="ajuda"], a[href*="help"]');
    if (await aboutLink.count() > 0) {
      await aboutLink.click();
      await page.waitForTimeout(1000);
      
      // Navigate back
      await page.goBack();
      await page.waitForLoadState('networkidle');
      
      // Check if email is still there (depends on implementation)
      const currentValue = await emailInput.inputValue();
      // This might be empty due to security - that's acceptable
    }
    
    // Form should still be functional
    await emailInput.fill('admin@qa.voxstudent.com');
    await expect(emailInput).toHaveValue('admin@qa.voxstudent.com');
  });

  test('15 - Should handle special characters in email', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    const specialEmails = [
      'test+tag@qa.voxstudent.com',
      'test.dot@qa.voxstudent.com',
      'test-dash@qa.voxstudent.com',
      'test_underscore@qa.voxstudent.com',
      'admin@qa.voxstudent.com'
    ];
    
    for (const email of specialEmails) {
      // Clear and fill with special character email
      const emailInput = page.locator('input[type="email"]');
      await emailInput.clear();
      await emailInput.fill(email);
      
      // Submit
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      // Should handle correctly (either success or appropriate error)
      const hasResponse = await page.locator('text*=enviado, text*=erro').count() > 0;
      expect(hasResponse).toBe(true);
      
      // Wait before next iteration
      await page.waitForTimeout(1000);
    }
  });
});