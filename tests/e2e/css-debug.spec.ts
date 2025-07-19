import { test, expect } from '@playwright/test';

test('debug CSS loading', async ({ page }) => {
  // Capture network requests to see what CSS is loading
  const cssRequests: string[] = [];
  
  page.on('response', response => {
    if (response.url().includes('.css') || response.headers()['content-type']?.includes('text/css')) {
      cssRequests.push(`${response.status()} - ${response.url()}`);
    }
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  console.log('CSS Requests:');
  cssRequests.forEach(req => console.log('  ', req));
  
  // Check if globals.css is loaded
  const hasGlobalsCss = cssRequests.some(req => req.includes('globals.css'));
  console.log('globals.css loaded:', hasGlobalsCss);
  
  // Check computed styles on the main container
  const styles = await page.evaluate(() => {
    const container = document.querySelector('[class*="min-h-screen"]');
    if (!container) return 'No container found';
    
    const computed = window.getComputedStyle(container);
    return {
      background: computed.background,
      minHeight: computed.minHeight,
      display: computed.display,
      classes: container.className
    };
  });
  
  console.log('Container styles:', JSON.stringify(styles, null, 2));
  
  await page.screenshot({ path: 'test-results/css-debug.png' });
});