import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Go to the login page
  await page.goto('/login');

  // Fill in the email field
  await page.fill('input[type="email"]', 'luciano@hcktplanet.com');

  // Click the magic link button
  await page.click('button:has-text("Enviar Link Mágico")');

  // Wait for success message
  await expect(page.locator('text=Link enviado com sucesso!')).toBeVisible();

  // For testing purposes, we'll simulate the magic link verification
  // In a real scenario, you'd need to check email or use a test email service
  
  // Navigate directly to a magic link (this would normally come from email)
  // For testing, we'll use the database to get a valid token
  // This is a simplified approach - in production you'd use a test email service
  
  // For now, let's just set a token in localStorage to simulate authentication
  await page.evaluate(() => {
    // This is a mock token for testing - in real tests you'd get this from the magic link
    localStorage.setItem('auth_token', 'test-auth-token');
  });

  // Save signed-in state to 'authFile'.
  await page.context().storageState({ path: authFile });
});
