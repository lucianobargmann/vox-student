import { test, expect } from '@playwright/test';

test.describe('Lesson Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Login with admin credentials (assuming they exist)
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.click('button[type="submit"]');
    
    // Wait for potential redirect or magic link flow
    await page.waitForTimeout(2000);
  });

  test('should show generate lessons button when no lessons exist', async ({ page }) => {
    // Navigate to classes page
    await page.goto('/admin/classes');
    
    // Look for a class to edit (or create one if needed)
    const editButton = page.locator('a[href*="/admin/classes/"][href*="/edit"]').first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Check if the lesson calendar is present
      const lessonCalendar = page.locator('text=Calendário de Aulas');
      await expect(lessonCalendar).toBeVisible();
      
      // Check if there's a "Gerar Aulas" button when no lessons exist
      const generateButton = page.locator('button:has-text("Gerar Aulas")');
      const regenerateButton = page.locator('button:has-text("Regenerar")');
      
      // Either generate or regenerate button should be visible
      const hasGenerateButton = await generateButton.count() > 0;
      const hasRegenerateButton = await regenerateButton.count() > 0;
      
      expect(hasGenerateButton || hasRegenerateButton).toBeTruthy();
      
      if (hasGenerateButton) {
        // Test the generate lessons functionality
        await generateButton.click();
        
        // Wait for the API call to complete
        await page.waitForTimeout(3000);
        
        // Check for success message (toast)
        const successMessage = page.locator('text*="aulas foram geradas"');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        
        // Verify that lessons are now displayed
        const lessonItems = page.locator('[data-testid="lesson-item"]');
        await expect(lessonItems.first()).toBeVisible({ timeout: 5000 });
      }
    } else {
      console.log('No classes found to test lesson generation');
    }
  });

  test('should show regenerate button when lessons exist', async ({ page }) => {
    // Navigate to classes page
    await page.goto('/admin/classes');
    
    // Look for a class to edit
    const editButton = page.locator('a[href*="/admin/classes/"][href*="/edit"]').first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Check if lessons exist
      const lessonItems = page.locator('[data-testid="lesson-item"]');
      
      if (await lessonItems.count() > 0) {
        // If lessons exist, there should be a regenerate button
        const regenerateButton = page.locator('button:has-text("Regenerar")');
        await expect(regenerateButton).toBeVisible();
        
        // Test the regenerate functionality
        await regenerateButton.click();
        
        // Wait for the API call to complete
        await page.waitForTimeout(3000);
        
        // Check for success message
        const successMessage = page.locator('text*="aulas foram regeneradas"');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should display lesson calendar with correct information', async ({ page }) => {
    // Navigate to classes page
    await page.goto('/admin/classes');
    
    // Look for a class to edit
    const editButton = page.locator('a[href*="/admin/classes/"][href*="/edit"]').first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Check lesson calendar components
      const calendarTitle = page.locator('text=Calendário de Aulas');
      await expect(calendarTitle).toBeVisible();
      
      // Check if lessons are displayed with proper information
      const lessonItems = page.locator('[data-testid="lesson-item"]');
      
      if (await lessonItems.count() > 0) {
        const firstLesson = lessonItems.first();
        
        // Check that lesson has title
        const lessonTitle = firstLesson.locator('h4');
        await expect(lessonTitle).toBeVisible();
        
        // Check that lesson has date information
        const lessonDate = firstLesson.locator('text*="/"'); // Date format dd/MM/yyyy
        await expect(lessonDate).toBeVisible();
        
        // Check that lesson has time information
        const lessonTime = firstLesson.locator('text*=":"'); // Time format HH:mm
        await expect(lessonTime).toBeVisible();
      }
    }
  });
});
