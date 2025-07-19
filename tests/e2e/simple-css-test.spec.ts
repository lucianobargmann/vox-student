import { test, expect } from '@playwright/test';

test('simple CSS test', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot to see what's actually rendering
  await page.screenshot({ path: 'test-results/simple-css-test.png', fullPage: true });
  
  // Check if any CSS is loaded at all
  const hasStyles = await page.evaluate(() => {
    const computed = window.getComputedStyle(document.body);
    return computed.fontFamily !== 'Times' && computed.fontFamily !== 'serif';
  });
  
  console.log('Has custom styles:', hasStyles);
  
  // Try to find the actual login container
  const loginContainer = page.locator('[class*="min-h-screen"]');
  if (await loginContainer.count() > 0) {
    console.log('Found login container with Tailwind classes');
  } else {
    console.log('No Tailwind classes found - CSS not loading');
  }
});