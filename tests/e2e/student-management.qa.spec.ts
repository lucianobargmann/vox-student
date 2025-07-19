import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestStudent {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  birthDate?: string;
  address?: string;
  notes?: string;
}

const TEST_STUDENTS: TestStudent[] = [
  {
    name: 'QA Test - Maria Silva Santos',
    email: 'maria.qa@test.voxstudent.com',
    phone: '(11) 99999-1111',
    whatsapp: '5511999991111',
    birthDate: '1995-05-15',
    address: 'Rua das Flores, 123 - São Paulo, SP',
    notes: 'Estudante de teste - pode ser removida'
  },
  {
    name: 'QA Test - João Pedro Lima',
    email: 'joao.qa@test.voxstudent.com',
    phone: '(11) 99999-2222',
    whatsapp: '5511999992222',
    birthDate: '1988-12-03',
    address: 'Av. Paulista, 456 - São Paulo, SP',
    notes: 'Estudante de teste para enrollment'
  },
  {
    name: 'QA Test - Ana Carolina Costa',
    email: 'ana.qa@test.voxstudent.com',
    phone: '(11) 99999-3333',
    whatsapp: '5511999993333',
    birthDate: '1992-08-20',
    address: 'Rua dos Jardins, 789 - São Paulo, SP',
    notes: 'Estudante de teste para transferência'
  }
];

test.describe('Student Management E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let createdStudentIds: string[] = [];

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
    // Cleanup created students
    for (const studentId of createdStudentIds) {
      try {
        await page.goto(`${BASE_URL}/admin/students`);
        await page.waitForTimeout(1000);
        // Additional cleanup can be added here
      } catch (error) {
        console.log(`Cleanup failed for student ${studentId}:`, error);
      }
    }
    
    await context.close();
  });

  test.beforeEach(async () => {
    await page.screenshot({ 
      path: `./screenshots/student-mgmt-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  // NAVIGATION & LAYOUT TESTS
  test('01 - Should navigate to students list page', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Check page structure
    const pageTitle = page.locator('h1, h2').first();
    await expect(pageTitle).toContainText(/estudante|aluno/i);
    
    // Check for "New Student" button
    const newStudentButton = page.locator('text*=Novo Estudante, text*=Adicionar Estudante, text*=Criar Estudante, [href*="/students/new"]');
    await expect(newStudentButton.first()).toBeVisible();
    
    // Check for students table or list
    const studentsContainer = page.locator('table, [role="table"], .students-list, .grid');
    await expect(studentsContainer.first()).toBeVisible();
  });

  test('02 - Should navigate to create student form', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Click on "New Student" button
    const newStudentButton = page.locator('text*=Novo Estudante, text*=Adicionar Estudante, text*=Criar Estudante').first();
    await newStudentButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Should be on create student page
    expect(page.url()).toContain('/students/new');
    
    // Check form elements
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Check required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    await expect(nameField).toBeVisible();
    await expect(emailField).toBeVisible();
  });

  // CREATE STUDENT TESTS
  test('03 - Should validate required fields on student creation', async () => {
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Should show validation errors or prevent submission
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    // Check if fields are marked as invalid
    const nameInvalid = await nameField.evaluate(el => (el as HTMLInputElement).validity.valid === false);
    const emailInvalid = await emailField.evaluate(el => (el as HTMLInputElement).validity.valid === false);
    
    // At least one should be invalid, or we should see error messages
    const hasValidationErrors = nameInvalid || emailInvalid || 
      await page.locator('text*=obrigatório, text*=required, text*=erro').count() > 0;
    
    expect(hasValidationErrors).toBe(true);
  });

  test('04 - Should create a new student with minimal data', async () => {
    const testStudent = TEST_STUDENTS[0];
    
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    await nameField.fill(testStudent.name);
    await emailField.fill(testStudent.email);
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect to students list or show success
    const hasRedirected = page.url().includes('/students') && !page.url().includes('/new');
    const hasSuccessMessage = await page.locator('text*=sucesso, text*=criado, text*=adicionado').count() > 0;
    
    expect(hasRedirected || hasSuccessMessage).toBe(true);
    
    // Verify student appears in list
    if (hasRedirected) {
      await expect(page.locator(`text=${testStudent.name}`)).toBeVisible();
    }
  });

  test('05 - Should create a student with complete data', async () => {
    const testStudent = TEST_STUDENTS[1];
    
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill all available fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    await nameField.fill(testStudent.name);
    await emailField.fill(testStudent.email);
    
    // Fill optional fields if they exist
    const phoneField = page.locator('input[name="phone"], input[id="phone"]');
    if (await phoneField.count() > 0) {
      await phoneField.fill(testStudent.phone!);
    }
    
    const whatsappField = page.locator('input[name="whatsapp"], input[id="whatsapp"]');
    if (await whatsappField.count() > 0) {
      await whatsappField.fill(testStudent.whatsapp!);
    }
    
    const birthDateField = page.locator('input[name="birthDate"], input[id="birthDate"], input[type="date"]');
    if (await birthDateField.count() > 0) {
      await birthDateField.fill(testStudent.birthDate!);
    }
    
    const addressField = page.locator('input[name="address"], textarea[name="address"], input[id="address"]');
    if (await addressField.count() > 0) {
      await addressField.fill(testStudent.address!);
    }
    
    const notesField = page.locator('textarea[name="notes"], textarea[id="notes"]');
    if (await notesField.count() > 0) {
      await notesField.fill(testStudent.notes!);
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Verify creation
    const hasSuccess = page.url().includes('/students') || 
      await page.locator('text*=sucesso, text*=criado').count() > 0;
    
    expect(hasSuccess).toBe(true);
  });

  test('06 - Should validate email format during creation', async () => {
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    const invalidEmails = [
      'invalid-email',
      'test@',
      '@domain.com',
      'test..test@domain.com',
      'test@domain'
    ];
    
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    const submitButton = page.locator('button[type="submit"]');
    
    for (const invalidEmail of invalidEmails) {
      await nameField.fill('Test Student');
      await emailField.clear();
      await emailField.fill(invalidEmail);
      
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Should show validation error
      const isValid = await emailField.evaluate(el => (el as HTMLInputElement).validity.valid);
      expect(isValid).toBe(false);
    }
  });

  // READ STUDENT TESTS
  test('07 - Should display students list with pagination', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Check if students are displayed
    const studentsList = page.locator('table tbody tr, .student-card, .student-item');
    const studentsCount = await studentsList.count();
    
    // Should have at least the students we created
    expect(studentsCount).toBeGreaterThan(0);
    
    // Check for pagination if there are many students
    const paginationContainer = page.locator('.pagination, [aria-label*="pagination"], nav[role="navigation"]');
    if (await paginationContainer.count() > 0) {
      // Test pagination
      const nextButton = page.locator('button:has-text("Próximo"), button:has-text("Next"), [aria-label*="next"]');
      if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        
        // Should change page
        await page.screenshot({ 
          path: './screenshots/student-mgmt-pagination.png',
          fullPage: true 
        });
      }
    }
  });

  test('08 - Should view student details', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Find a test student and click to view details
    const studentRow = page.locator(`tr:has-text("${TEST_STUDENTS[0].name}"), .student-card:has-text("${TEST_STUDENTS[0].name}")`);
    
    if (await studentRow.count() > 0) {
      // Look for view/details button
      const viewButton = studentRow.locator('button:has-text("Ver"), button:has-text("Detalhes"), a:has-text("Ver"), [aria-label*="view"]');
      
      if (await viewButton.count() > 0) {
        await viewButton.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should show student details
        await expect(page.locator(`text=${TEST_STUDENTS[0].name}`)).toBeVisible();
        await expect(page.locator(`text=${TEST_STUDENTS[0].email}`)).toBeVisible();
      } else {
        // Try clicking on student name
        const studentName = studentRow.locator(`text=${TEST_STUDENTS[0].name}`);
        await studentName.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('09 - Should search for students', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Look for search field
    const searchField = page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"], input[type="search"]');
    
    if (await searchField.count() > 0) {
      // Search for test student
      await searchField.fill('QA Test');
      await page.waitForTimeout(2000);
      
      // Should show filtered results
      const searchResults = page.locator('tbody tr, .student-card');
      const resultCount = await searchResults.count();
      
      // Should have at least our test students
      expect(resultCount).toBeGreaterThan(0);
      
      // Verify results contain search term
      await expect(page.locator('text*=QA Test')).toBeVisible();
      
      // Clear search
      await searchField.clear();
      await page.waitForTimeout(1000);
    }
  });

  // UPDATE STUDENT TESTS
  test('10 - Should navigate to edit student form', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Find test student and click edit
    const studentRow = page.locator(`tr:has-text("${TEST_STUDENTS[0].name}"), .student-card:has-text("${TEST_STUDENTS[0].name}")`);
    await expect(studentRow.first()).toBeVisible();
    
    // Look for edit button
    const editButton = studentRow.first().locator('button:has-text("Editar"), a:has-text("Editar"), [aria-label*="edit"], [title*="edit"]');
    
    if (await editButton.count() === 0) {
      // Look for icon buttons (pencil, edit icons)
      const iconButtons = studentRow.first().locator('button:has(svg), button[aria-label*="edit"]');
      if (await iconButtons.count() > 0) {
        await iconButtons.first().click();
      }
    } else {
      await editButton.first().click();
    }
    
    await page.waitForLoadState('networkidle');
    
    // Should be on edit page
    expect(page.url()).toContain('/edit');
    
    // Form should be pre-filled with student data
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const currentName = await nameField.inputValue();
    expect(currentName).toContain('QA Test');
  });

  test('11 - Should update student information', async () => {
    const originalStudent = TEST_STUDENTS[0];
    const updatedName = `${originalStudent.name} - Editado`;
    const updatedPhone = '(11) 99999-9999';
    
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Find and edit the student
    const studentRow = page.locator(`tr:has-text("${originalStudent.name}"), .student-card:has-text("${originalStudent.name}")`);
    const editButton = studentRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Update fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const phoneField = page.locator('input[name="phone"], input[id="phone"]');
    
    await nameField.clear();
    await nameField.fill(updatedName);
    
    if (await phoneField.count() > 0) {
      await phoneField.clear();
      await phoneField.fill(updatedPhone);
    }
    
    // Submit changes
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Atualizar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect back to students list
    expect(page.url()).toContain('/students');
    expect(page.url()).not.toContain('/edit');
    
    // Verify updated student appears in list
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    
    // Update our test data for cleanup
    TEST_STUDENTS[0].name = updatedName;
  });

  // ENROLLMENT TESTS
  test('12 - Should enroll student in course', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Find a student
    const studentRow = page.locator(`tr:has-text("${TEST_STUDENTS[1].name}"), .student-card:has-text("${TEST_STUDENTS[1].name}")`);
    
    if (await studentRow.count() > 0) {
      // Look for enroll button
      const enrollButton = studentRow.first().locator('button:has-text("Matricular"), button:has-text("Enroll"), [aria-label*="enroll"]');
      
      if (await enrollButton.count() > 0) {
        await enrollButton.click();
        await page.waitForTimeout(2000);
        
        // Should show enrollment modal or form
        const enrollModal = page.locator('[role="dialog"], .modal, .enrollment-form');
        await expect(enrollModal.first()).toBeVisible();
        
        // Look for course selection
        const courseSelect = page.locator('select[name="course"], select[id="course"]');
        if (await courseSelect.count() > 0) {
          // Select first available course
          await courseSelect.selectOption({ index: 1 });
          
          // Confirm enrollment
          const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Matricular")');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForTimeout(3000);
            
            // Should show success message
            const hasSuccess = await page.locator('text*=matriculado, text*=enrolled').count() > 0;
            expect(hasSuccess).toBe(true);
          }
        }
      }
    }
  });

  test('13 - Should handle enrollment capacity limits', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // This test assumes there might be capacity-limited courses
    const studentRow = page.locator('tbody tr').first();
    
    if (await studentRow.count() > 0) {
      const enrollButton = studentRow.locator('button:has-text("Matricular"), [aria-label*="enroll"]');
      
      if (await enrollButton.count() > 0) {
        await enrollButton.click();
        await page.waitForTimeout(2000);
        
        // Try to enroll in a course
        const courseSelect = page.locator('select[name="course"]');
        if (await courseSelect.count() > 0) {
          await courseSelect.selectOption({ index: 1 });
          
          const confirmButton = page.locator('button:has-text("Confirmar")');
          await confirmButton.click();
          await page.waitForTimeout(3000);
          
          // Should either succeed or show capacity warning
          const hasResponse = await page.locator('text*=matriculado, text*=capacidade, text*=lotado').count() > 0;
          expect(hasResponse).toBe(true);
        }
      }
    }
  });

  // DELETE STUDENT TESTS
  test('14 - Should show delete confirmation dialog', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Find a test student to delete
    const studentRow = page.locator(`tr:has-text("${TEST_STUDENTS[2].name}"), .student-card:has-text("${TEST_STUDENTS[2].name}")`);
    
    if (await studentRow.count() > 0) {
      // Look for delete button
      const deleteButton = studentRow.first().locator('button:has-text("Excluir"), button:has-text("Delete"), [aria-label*="delete"], [title*="delete"]');
      
      if (await deleteButton.count() === 0) {
        // Look for icon buttons (trash, delete icons)
        const iconButtons = studentRow.first().locator('button:has(svg)');
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

  test('15 - Should prevent deletion of students with active enrollments', async () => {
    // This test assumes there are students with active enrollments
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Try to delete a student that might have enrollments
    const studentsWithData = page.locator('tbody tr').first();
    
    if (await studentsWithData.count() > 0) {
      const deleteButton = studentsWithData.locator('button:has(svg)').last();
      await deleteButton.click();
      
      await page.waitForTimeout(1000);
      
      // Try to confirm deletion
      const confirmButton = page.locator('button:has-text("Excluir"), button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        
        await page.waitForTimeout(3000);
        
        // Should either prevent deletion or show warning
        const hasWarning = await page.locator('text*=matrícula, text*=enrollment, text*=não pode ser excluído').count() > 0;
        const studentStillExists = await studentsWithData.count() > 0;
        
        // Either show warning or student still exists
        expect(hasWarning || studentStillExists).toBe(true);
      }
    }
  });

  // RESPONSIVE DESIGN TESTS
  test('16 - Should test responsive design for student management', async () => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Student list should be responsive
    const studentsContainer = page.locator('table, .students-list, .student-grid');
    await expect(studentsContainer.first()).toBeVisible();
    
    // New student button should be accessible
    const newStudentButton = page.locator('text*=Novo, text*=Adicionar, [href*="/new"]');
    await expect(newStudentButton.first()).toBeVisible();
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: './screenshots/student-mgmt-mobile.png',
      fullPage: true 
    });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    // Form should be responsive
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Take tablet screenshot
    await page.screenshot({ 
      path: './screenshots/student-mgmt-tablet.png',
      fullPage: true 
    });
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  // ERROR HANDLING TESTS
  test('17 - Should handle form errors gracefully', async () => {
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    // Simulate network error during form submission
    await page.route('**/api/students', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Fill and submit form
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    await nameField.fill('Test Error Handling');
    await emailField.fill('error@test.com');
    
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
    await page.unroute('**/api/students');
  });

  // ACCESSIBILITY TESTS
  test('18 - Should test accessibility features', async () => {
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle');
    
    // Check for proper table headers
    const tableHeaders = page.locator('th[scope="col"], thead th');
    if (await tableHeaders.count() > 0) {
      expect(await tableHeaders.count()).toBeGreaterThan(0);
    }
    
    // Check for proper labels on form
    await page.goto(`${BASE_URL}/admin/students/new`);
    await page.waitForLoadState('networkidle');
    
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const emailField = page.locator('input[name="email"], input[id="email"]');
    
    // Should have labels, aria-labels, or placeholders
    const nameHasLabel = await page.locator('label[for="name"]').count() > 0 ||
      await nameField.getAttribute('aria-label') !== null ||
      await nameField.getAttribute('placeholder') !== null;
    
    const emailHasLabel = await page.locator('label[for="email"]').count() > 0 ||
      await emailField.getAttribute('aria-label') !== null ||
      await emailField.getAttribute('placeholder') !== null;
    
    expect(nameHasLabel).toBe(true);
    expect(emailHasLabel).toBe(true);
    
    // Check keyboard navigation
    await nameField.focus();
    await page.keyboard.press('Tab');
    await expect(emailField).toBeFocused();
    
    await page.screenshot({ 
      path: './screenshots/student-mgmt-accessibility.png',
      fullPage: true 
    });
  });
});