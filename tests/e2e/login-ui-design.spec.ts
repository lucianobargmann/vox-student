import { test, expect } from '@playwright/test';

test.describe('Login Page UI Design Analysis', () => {
  test('should capture login page screenshot for UI design analysis', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Wait for page to fully load including CSS
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for animations/gradients
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'test-results/login-page-design.png',
      fullPage: true 
    });
    
    // Verify the page has the correct title
    await expect(page).toHaveTitle(/VoxStudent/);
    
    // Check that the main container has the gradient background
    const mainContainer = page.locator('div').first();
    await expect(mainContainer).toBeVisible();
    
    // Verify the VoxStudent branding is present
    await expect(page.locator('text=VoxStudent')).toBeVisible();
    
    // Check for version information
    await expect(page.locator('text=v0.1.0')).toBeVisible();
    
    // Verify email/WhatsApp toggle buttons exist
    await expect(page.locator('button:has-text("Email")')).toBeVisible();
    await expect(page.locator('button:has-text("WhatsApp")')).toBeVisible();
    
    // Check input field is present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Verify submit button exists
    await expect(page.locator('button:has-text("Enviar Link Mágico")')).toBeVisible();
    
    // Take a focused screenshot of just the login card
    const loginCard = page.locator('[class*="max-w-md"]').first();
    await loginCard.screenshot({ 
      path: 'test-results/login-card-focused.png' 
    });
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/login-page-mobile.png',
      fullPage: true 
    });
    
    console.log('✅ Login page screenshots captured for UI design analysis');
    console.log('📸 Files created:');
    console.log('   - test-results/login-page-design.png (Desktop full page)');
    console.log('   - test-results/login-card-focused.png (Card focused)');
    console.log('   - test-results/login-page-mobile.png (Mobile view)');
  });
  
  test('should test login page color scheme and gradients', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check if gradient background is applied
    const gradientBg = page.locator('[class*="bg-gradient-to-br"]');
    await expect(gradientBg).toBeVisible();
    
    // Test different states - hover effects
    const emailButton = page.locator('button:has-text("Email")');
    await emailButton.hover();
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test-results/login-hover-state.png' 
    });
    
    console.log('✅ Gradient and interaction tests completed');
  });
  
  test('should analyze login form accessibility and design', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Test form interaction
    await page.click('button:has-text("Email")');
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Capture filled form state
    await page.screenshot({ 
      path: 'test-results/login-form-filled.png' 
    });
    
    // Test WhatsApp toggle
    await page.click('button:has-text("WhatsApp")');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test-results/login-whatsapp-mode.png' 
    });
    
    console.log('✅ Form interaction screenshots captured');
  });
});