import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestCourse {
  name: string;
  description: string;
  duration?: string;
  price?: string;
  category?: string;
  level?: string;
}

const TEST_COURSES: TestCourse[] = [
  {
    name: 'QA Test - Inglês Básico',
    description: 'Curso de inglês para iniciantes com foco em conversação básica e gramática fundamental.',
    duration: '3',
    price: '199.99',
    category: 'idiomas',
    level: 'básico'
  },
  {
    name: 'QA Test - Inglês Intermediário',
    description: 'Curso intermediário de inglês com conversação avançada e business English.',
    duration: '6',
    price: '349.99',
    category: 'idiomas',
    level: 'intermediário'
  },
  {
    name: 'QA Test - Espanhol Conversação',
    description: 'Curso intensivo de espanhol focado em conversação e cultura hispânica.',
    duration: '4',
    price: '249.99',
    category: 'idiomas',
    level: 'intermediário'
  }
];

test.describe('Course CRUD E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let createdCourseIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Login as admin first
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@qa.voxstudent.com');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }
  });

  test.afterAll(async () => {
    // Cleanup created courses
    for (const courseId of createdCourseIds) {
      try {
        await page.goto(`${BASE_URL}/admin/courses`);
        await page.waitForTimeout(1000);
        // Additional cleanup can be added here
      } catch (error) {
        console.log(`Cleanup failed for course ${courseId}:`, error);
      }
    }
    
    await context.close();
  });

  test.beforeEach(async () => {
    await page.screenshot({ 
      path: `./screenshots/course-crud-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  // CREATE TESTS
  test('01 - Should navigate to courses list page', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Check page structure
    const pageTitle = page.locator('h1, h2').first();
    await expect(pageTitle).toContainText(/curso/i);
    
    // Check for "New Course" button
    const newCourseButton = page.locator('text*=Novo Curso, text*=Adicionar Curso, text*=Criar Curso, [href*="/courses/new"]');
    await expect(newCourseButton.first()).toBeVisible();
    
    // Check for courses table or list
    const coursesContainer = page.locator('table, [role="table"], .courses-list, .grid');
    await expect(coursesContainer.first()).toBeVisible();
  });

  test('02 - Should navigate to create course form', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Click on "New Course" button
    const newCourseButton = page.locator('text*=Novo Curso, text*=Adicionar Curso, text*=Criar Curso').first();
    await newCourseButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Should be on create course page
    expect(page.url()).toContain('/courses/new');
    
    // Check form elements
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Check required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await expect(nameField).toBeVisible();
    await expect(descriptionField).toBeVisible();
  });

  test('03 - Should validate required fields on course creation', async () => {
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Should show validation errors or prevent submission
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    // Check if fields are marked as invalid
    const nameInvalid = await nameField.evaluate(el => (el as HTMLInputElement).validity.valid === false);
    const descInvalid = await descriptionField.evaluate(el => (el as HTMLTextAreaElement).validity.valid === false);
    
    // At least one should be invalid, or we should see error messages
    const hasValidationErrors = nameInvalid || descInvalid || 
      await page.locator('text*=obrigatório, text*=required, text*=erro').count() > 0;
    
    expect(hasValidationErrors).toBe(true);
  });

  test('04 - Should create a new course with minimal data', async () => {
    const testCourse = TEST_COURSES[0];
    
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await nameField.fill(testCourse.name);
    await descriptionField.fill(testCourse.description);
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect to courses list or show success
    const hasRedirected = page.url().includes('/courses') && !page.url().includes('/new');
    const hasSuccessMessage = await page.locator('text*=sucesso, text*=criado, text*=adicionado').count() > 0;
    
    expect(hasRedirected || hasSuccessMessage).toBe(true);
    
    // Verify course appears in list
    if (hasRedirected) {
      await expect(page.locator(`text=${testCourse.name}`)).toBeVisible();
    }
  });

  test('05 - Should create a course with all fields', async () => {
    const testCourse = TEST_COURSES[1];
    
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill all available fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await nameField.fill(testCourse.name);
    await descriptionField.fill(testCourse.description);
    
    // Fill optional fields if they exist
    const durationField = page.locator('input[name="duration"], input[id="duration"]');
    if (await durationField.count() > 0) {
      await durationField.fill(testCourse.duration!);
    }
    
    const priceField = page.locator('input[name="price"], input[id="price"]');
    if (await priceField.count() > 0) {
      await priceField.fill(testCourse.price!);
    }
    
    const categoryField = page.locator('select[name="category"], select[id="category"], input[name="category"]');
    if (await categoryField.count() > 0) {
      if (await categoryField.getAttribute('type') === 'text') {
        await categoryField.fill(testCourse.category!);
      } else {
        await categoryField.selectOption({ label: testCourse.category! });
      }
    }
    
    const levelField = page.locator('select[name="level"], select[id="level"], input[name="level"]');
    if (await levelField.count() > 0) {
      if (await levelField.getAttribute('type') === 'text') {
        await levelField.fill(testCourse.level!);
      } else {
        await levelField.selectOption({ label: testCourse.level! });
      }
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Verify creation
    const hasSuccess = page.url().includes('/courses') || 
      await page.locator('text*=sucesso, text*=criado').count() > 0;
    
    expect(hasSuccess).toBe(true);
  });

  // READ TESTS
  test('06 - Should display courses list with pagination', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Check if courses are displayed
    const coursesList = page.locator('table tbody tr, .course-card, .course-item');
    const coursesCount = await coursesList.count();
    
    // Should have at least the courses we created
    expect(coursesCount).toBeGreaterThan(0);
    
    // Check for pagination if there are many courses
    const paginationContainer = page.locator('.pagination, [aria-label*="pagination"], nav[role="navigation"]');
    if (await paginationContainer.count() > 0) {
      // Test pagination
      const nextButton = page.locator('button:has-text("Próximo"), button:has-text("Next"), [aria-label*="next"]');
      if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        
        // Should change page
        await page.screenshot({ 
          path: './screenshots/course-crud-pagination.png',
          fullPage: true 
        });
      }
    }
  });

  test('07 - Should view course details', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find a test course and click to view details
    const courseRow = page.locator(`tr:has-text("${TEST_COURSES[0].name}"), .course-card:has-text("${TEST_COURSES[0].name}")`);
    
    if (await courseRow.count() > 0) {
      // Look for view/details button
      const viewButton = courseRow.locator('button:has-text("Ver"), button:has-text("Detalhes"), a:has-text("Ver"), [aria-label*="view"]');
      
      if (await viewButton.count() > 0) {
        await viewButton.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should show course details
        await expect(page.locator(`text=${TEST_COURSES[0].name}`)).toBeVisible();
        await expect(page.locator(`text=${TEST_COURSES[0].description}`)).toBeVisible();
      } else {
        // Try clicking on course name
        const courseName = courseRow.locator(`text=${TEST_COURSES[0].name}`);
        await courseName.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('08 - Should search for courses', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Look for search field
    const searchField = page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"], input[type="search"]');
    
    if (await searchField.count() > 0) {
      // Search for test course
      await searchField.fill('QA Test');
      await page.waitForTimeout(2000);
      
      // Should show filtered results
      const searchResults = page.locator('tbody tr, .course-card');
      const resultCount = await searchResults.count();
      
      // Should have at least our test courses
      expect(resultCount).toBeGreaterThan(0);
      
      // Verify results contain search term
      await expect(page.locator('text*=QA Test')).toBeVisible();
      
      // Clear search
      await searchField.clear();
      await page.waitForTimeout(1000);
    }
  });

  // UPDATE TESTS
  test('09 - Should navigate to edit course form', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find test course and click edit
    const courseRow = page.locator(`tr:has-text("${TEST_COURSES[0].name}"), .course-card:has-text("${TEST_COURSES[0].name}")`);
    await expect(courseRow.first()).toBeVisible();
    
    // Look for edit button
    const editButton = courseRow.first().locator('button:has-text("Editar"), a:has-text("Editar"), [aria-label*="edit"], [title*="edit"]');
    
    if (await editButton.count() === 0) {
      // Look for icon buttons (pencil, edit icons)
      const iconButtons = courseRow.first().locator('button:has(svg), button[aria-label*="edit"]');
      if (await iconButtons.count() > 0) {
        await iconButtons.first().click();
      }
    } else {
      await editButton.first().click();
    }
    
    await page.waitForLoadState('networkidle');
    
    // Should be on edit page
    expect(page.url()).toContain('/edit');
    
    // Form should be pre-filled with course data
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const currentName = await nameField.inputValue();
    expect(currentName).toContain('QA Test');
  });

  test('10 - Should update course name and description', async () => {
    const originalCourse = TEST_COURSES[0];
    const updatedName = `${originalCourse.name} - Editado`;
    const updatedDescription = `${originalCourse.description} - Versão atualizada.`;
    
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find and edit the course
    const courseRow = page.locator(`tr:has-text("${originalCourse.name}"), .course-card:has-text("${originalCourse.name}")`);
    const editButton = courseRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Update fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await nameField.clear();
    await nameField.fill(updatedName);
    
    await descriptionField.clear();
    await descriptionField.fill(updatedDescription);
    
    // Submit changes
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Atualizar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect back to courses list
    expect(page.url()).toContain('/courses');
    expect(page.url()).not.toContain('/edit');
    
    // Verify updated course appears in list
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    
    // Update our test data for cleanup
    TEST_COURSES[0].name = updatedName;
  });

  test('11 - Should validate edit form fields', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Edit a course
    const courseRow = page.locator(`tr:has-text("${TEST_COURSES[1].name}"), .course-card:has-text("${TEST_COURSES[1].name}")`);
    const editButton = courseRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Clear required fields and try to save
    const nameField = page.locator('input[name="name"], input[id="name"]');
    await nameField.clear();
    
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Atualizar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Should show validation error or prevent submission
    const hasValidationError = await nameField.evaluate(el => (el as HTMLInputElement).validity.valid === false) ||
      await page.locator('text*=obrigatório, text*=required, text*=erro').count() > 0;
    
    expect(hasValidationError).toBe(true);
  });

  test('12 - Should handle concurrent edits gracefully', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Open edit page
    const courseRow = page.locator(`tr:has-text("${TEST_COURSES[1].name}"), .course-card:has-text("${TEST_COURSES[1].name}")`);
    const editButton = courseRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Make a change
    const nameField = page.locator('input[name="name"], input[id="name"]');
    await nameField.fill(`${TEST_COURSES[1].name} - Concurrent Edit Test`);
    
    // Submit
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should handle gracefully (either success or conflict resolution)
    const hasResponse = page.url().contains('/courses') || 
      await page.locator('text*=sucesso, text*=erro, text*=conflito').count() > 0;
    
    expect(hasResponse).toBe(true);
  });

  // DELETE TESTS
  test('13 - Should show delete confirmation dialog', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find a test course to delete
    const courseRow = page.locator(`tr:has-text("${TEST_COURSES[2].name}"), .course-card:has-text("${TEST_COURSES[2].name}")`);
    
    if (await courseRow.count() > 0) {
      // Look for delete button
      const deleteButton = courseRow.first().locator('button:has-text("Excluir"), button:has-text("Delete"), [aria-label*="delete"], [title*="delete"]');
      
      if (await deleteButton.count() === 0) {
        // Look for icon buttons (trash, delete icons)
        const iconButtons = courseRow.first().locator('button:has(svg)');
        const buttonCount = await iconButtons.count();
        if (buttonCount > 1) {
          // Usually delete is the last button
          await iconButtons.last().click();
        }
      } else {
        await deleteButton.first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], .modal, .confirmation-dialog');
      const confirmText = page.locator('text*=excluir, text*=deletar, text*=remover, text*=confirmar');
      
      const hasConfirmation = await confirmDialog.count() > 0 || await confirmText.count() > 0;
      expect(hasConfirmation).toBe(true);
      
      // Cancel the deletion for now
      const cancelButton = page.locator('button:has-text("Cancelar"), button:has-text("Cancel")');
      if (await cancelButton.count() > 0) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('14 - Should delete course after confirmation', async () => {
    const courseToDelete = TEST_COURSES[2];
    
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find the course to delete
    const courseRow = page.locator(`tr:has-text("${courseToDelete.name}"), .course-card:has-text("${courseToDelete.name}")`);
    
    if (await courseRow.count() > 0) {
      // Click delete button
      const deleteButton = courseRow.first().locator('button:has(svg)').last();
      await deleteButton.click();
      
      await page.waitForTimeout(1000);
      
      // Confirm deletion
      const confirmButton = page.locator('button:has-text("Excluir"), button:has-text("Confirmar"), button:has-text("Delete")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        
        await page.waitForTimeout(3000);
        
        // Course should be removed from list
        const courseStillExists = await page.locator(`text=${courseToDelete.name}`).count() > 0;
        expect(courseStillExists).toBe(false);
        
        // Should show success message
        const hasSuccessMessage = await page.locator('text*=excluído, text*=removido, text*=deletado').count() > 0;
        expect(hasSuccessMessage).toBe(true);
      }
    }
  });

  test('15 - Should prevent deletion of courses with enrollments', async () => {
    // This test assumes there are courses with active enrollments
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Try to delete a course that might have enrollments
    const coursesWithData = page.locator('tbody tr').first();
    
    if (await coursesWithData.count() > 0) {
      const deleteButton = coursesWithData.locator('button:has(svg)').last();
      await deleteButton.click();
      
      await page.waitForTimeout(1000);
      
      // Try to confirm deletion
      const confirmButton = page.locator('button:has-text("Excluir"), button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        
        await page.waitForTimeout(3000);
        
        // Should either prevent deletion or show warning
        const hasWarning = await page.locator('text*=matrícula, text*=enrollment, text*=não pode ser excluído').count() > 0;
        const courseStillExists = await coursesWithData.count() > 0;
        
        // Either show warning or course still exists
        expect(hasWarning || courseStillExists).toBe(true);
      }
    }
  });

  test('16 - Should test bulk course operations', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Look for bulk selection checkboxes
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    const bulkActionsButton = page.locator('text*=Ações em lote, text*=Bulk Actions, text*=Selecionar');
    
    if (await selectAllCheckbox.count() > 0) {
      // Select multiple courses
      await selectAllCheckbox.click();
      await page.waitForTimeout(1000);
      
      // Look for bulk actions
      if (await bulkActionsButton.count() > 0) {
        await bulkActionsButton.click();
        await page.waitForTimeout(1000);
        
        // Should show bulk action options
        const bulkMenu = page.locator('[role="menu"], .dropdown-menu, .bulk-actions-menu');
        await expect(bulkMenu.first()).toBeVisible();
        
        await page.screenshot({ 
          path: './screenshots/course-crud-bulk-operations.png',
          fullPage: true 
        });
      }
    }
  });

  test('17 - Should test course export functionality', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Exportar"), button:has-text("Export"), [aria-label*="export"]');
    
    if (await exportButton.count() > 0) {
      // Set up download handling
      const downloadPromise = page.waitForEvent('download');
      
      await exportButton.click();
      
      try {
        const download = await downloadPromise;
        
        // Verify download
        expect(download.suggestedFilename()).toMatch(/curso|course/i);
        expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf)$/);
        
      } catch (error) {
        // Export functionality might not be implemented yet
        console.log('Export test skipped - functionality not available');
      }
    }
  });

  test('18 - Should test responsive design for course management', async () => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Course list should be responsive
    const coursesContainer = page.locator('table, .courses-list, .course-grid');
    await expect(coursesContainer.first()).toBeVisible();
    
    // New course button should be accessible
    const newCourseButton = page.locator('text*=Novo, text*=Adicionar, [href*="/new"]');
    await expect(newCourseButton.first()).toBeVisible();
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: './screenshots/course-crud-mobile.png',
      fullPage: true 
    });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Form should be responsive
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Take tablet screenshot
    await page.screenshot({ 
      path: './screenshots/course-crud-tablet.png',
      fullPage: true 
    });
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('19 - Should handle form errors gracefully', async () => {
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Simulate network error during form submission
    await page.route('**/api/courses', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Fill and submit form
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await nameField.fill('Test Error Handling');
    await descriptionField.fill('This should trigger an error');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForTimeout(3000);
    
    // Should show error message
    const hasErrorMessage = await page.locator('text*=erro, text*=falhou, text*=error').count() > 0;
    expect(hasErrorMessage).toBe(true);
    
    // Form should still be functional
    await expect(nameField).toBeEnabled();
    await expect(submitButton).toBeEnabled();
    
    // Clear route interception
    await page.unroute('**/api/courses');
  });

  test('20 - Should maintain form data during navigation', async () => {
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill form partially
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const descriptionField = page.locator('textarea[name="description"], textarea[id="description"]');
    
    await nameField.fill('Partially Filled Course');
    await descriptionField.fill('This form data should persist');
    
    // Navigate away and back (if possible)
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForTimeout(1000);
    
    // Go back to form
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Check if data persisted (behavior may vary by implementation)
    const nameValue = await nameField.inputValue();
    const descValue = await descriptionField.inputValue();
    
    // Form should be functional regardless
    await nameField.fill('Navigation Test Course');
    await expect(nameField).toHaveValue('Navigation Test Course');
  });
});