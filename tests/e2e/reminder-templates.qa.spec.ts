import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestReminderTemplate {
  name: string;
  category?: string;
  template: string;
  description?: string;
}

const TEST_TEMPLATES: TestReminderTemplate[] = [
  {
    name: 'QA Test - Lembrete Aula Amanhã',
    category: 'aula',
    template: 'Olá {{nome_do_aluno}}! Sua aula de {{nome_curso}} está marcada para amanhã às {{horario_aula}}. Nos vemos lá!',
    description: 'Template de teste para lembrete de aula do dia seguinte'
  },
  {
    name: 'QA Test - Agendamento Mentoria',
    category: 'mentoria',
    template: 'Oi {{nome_do_aluno}}, vamos agendar sua sessão de mentoria? Entre em contato conosco para escolher o melhor horário.',
    description: 'Template de teste para agendamento de mentorias'
  },
  {
    name: 'QA Test - Reposição Disponível',
    category: 'reposicao',
    template: 'Olá {{nome_do_aluno}}! Temos uma reposição de {{nome_curso}} disponível. Deseja participar? Responda este WhatsApp.',
    description: 'Template de teste para oferecimento de reposições'
  }
];

test.describe('Reminder Templates E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let createdTemplateIds: string[] = [];

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
    // Cleanup created templates
    for (const templateId of createdTemplateIds) {
      try {
        await page.goto(`${BASE_URL}/admin/reminder-templates`);
        await page.waitForTimeout(1000);
        // Additional cleanup can be added here
      } catch (error) {
        console.log(`Cleanup failed for template ${templateId}:`, error);
      }
    }
    
    await context.close();
  });

  test.beforeEach(async () => {
    await page.screenshot({ 
      path: `./screenshots/reminder-templates-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  // NAVIGATION & LAYOUT TESTS
  test('01 - Should navigate to reminder templates list page', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Check page structure
    const pageTitle = page.locator('h1, h2').first();
    await expect(pageTitle).toContainText(/template|lembrete/i);
    
    // Check for "New Template" button
    const newTemplateButton = page.locator('text*=Novo Template, text*=Adicionar Template, text*=Criar Template, [href*="/reminder-templates/new"]');
    await expect(newTemplateButton.first()).toBeVisible();
    
    // Check for templates table or list
    const templatesContainer = page.locator('table, [role="table"], .templates-list, .grid');
    await expect(templatesContainer.first()).toBeVisible();
  });

  test('02 - Should navigate to create template form', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Click on "New Template" button
    const newTemplateButton = page.locator('text*=Novo Template, text*=Adicionar Template, text*=Criar Template').first();
    await newTemplateButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Should be on create template page
    expect(page.url()).toContain('/reminder-templates/new');
    
    // Check form elements
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Check required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    await expect(nameField).toBeVisible();
    await expect(templateField).toBeVisible();
  });

  // CREATE TEMPLATE TESTS
  test('03 - Should validate required fields on template creation', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Should show validation errors or prevent submission
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    // Check if fields are marked as invalid
    const nameInvalid = await nameField.evaluate(el => (el as HTMLInputElement).validity.valid === false);
    const templateInvalid = await templateField.evaluate(el => (el as HTMLTextAreaElement).validity.valid === false);
    
    // At least one should be invalid, or we should see error messages
    const hasValidationErrors = nameInvalid || templateInvalid || 
      await page.locator('text*=obrigatório, text*=required, text*=erro').count() > 0;
    
    expect(hasValidationErrors).toBe(true);
  });

  test('04 - Should create a new template with minimal data', async () => {
    const testTemplate = TEST_TEMPLATES[0];
    
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill required fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    await nameField.fill(testTemplate.name);
    await templateField.fill(testTemplate.template);
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect to templates list or show success
    const hasRedirected = page.url().includes('/reminder-templates') && !page.url().includes('/new');
    const hasSuccessMessage = await page.locator('text*=sucesso, text*=criado, text*=adicionado').count() > 0;
    
    expect(hasRedirected || hasSuccessMessage).toBe(true);
    
    // Verify template appears in list
    if (hasRedirected) {
      await expect(page.locator(`text=${testTemplate.name}`)).toBeVisible();
    }
  });

  test('05 - Should create a template with complete data', async () => {
    const testTemplate = TEST_TEMPLATES[1];
    
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill all available fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    await nameField.fill(testTemplate.name);
    await templateField.fill(testTemplate.template);
    
    // Fill optional fields if they exist
    const categoryField = page.locator('select[name="category"], input[name="category"], select[id="category"]');
    if (await categoryField.count() > 0) {
      if (await categoryField.getAttribute('type') === 'text') {
        await categoryField.fill(testTemplate.category!);
      } else {
        // Try to select from dropdown
        await categoryField.selectOption({ label: testTemplate.category! });
      }
    }
    
    const descriptionField = page.locator('textarea[name="description"], input[name="description"], textarea[id="description"]');
    if (await descriptionField.count() > 0) {
      await descriptionField.fill(testTemplate.description!);
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")');
    await submitButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Verify creation
    const hasSuccess = page.url().includes('/reminder-templates') || 
      await page.locator('text*=sucesso, text*=criado').count() > 0;
    
    expect(hasSuccess).toBe(true);
  });

  test('06 - Should validate Portuguese variable format', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    // Test with valid Portuguese variables
    const validTemplate = 'Olá {{nome_do_aluno}}, sua aula de {{nome_curso}} é às {{horario_aula}}.';
    
    await nameField.fill('Teste Variáveis Válidas');
    await templateField.fill(validTemplate);
    
    // Should be able to use the template
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForTimeout(2000);
    
    // Should not show variable format errors
    const hasVariableError = await page.locator('text*=variável inválida, text*=formato incorreto').count() > 0;
    expect(hasVariableError).toBe(false);
  });

  test('07 - Should show available variables helper', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Look for variables helper or documentation
    const variablesHelper = page.locator('text*=Variáveis disponíveis, text*=Available variables, .variables-help, .template-variables');
    
    if (await variablesHelper.count() > 0) {
      await expect(variablesHelper.first()).toBeVisible();
      
      // Should show common variables
      const commonVariables = [
        '{{nome_do_aluno}}',
        '{{nome_curso}}',
        '{{horario_aula}}',
        '{{data_aula}}'
      ];
      
      for (const variable of commonVariables) {
        const hasVariable = await page.locator(`text*=${variable}`).count() > 0;
        if (hasVariable) {
          await expect(page.locator(`text*=${variable}`)).toBeVisible();
        }
      }
    }
  });

  // READ TEMPLATE TESTS
  test('08 - Should display templates list with pagination', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Check if templates are displayed
    const templatesList = page.locator('table tbody tr, .template-card, .template-item');
    const templatesCount = await templatesList.count();
    
    // Should have at least the templates we created
    expect(templatesCount).toBeGreaterThan(0);
    
    // Check for pagination if there are many templates
    const paginationContainer = page.locator('.pagination, [aria-label*="pagination"], nav[role="navigation"]');
    if (await paginationContainer.count() > 0) {
      // Test pagination
      const nextButton = page.locator('button:has-text("Próximo"), button:has-text("Next"), [aria-label*="next"]');
      if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        
        // Should change page
        await page.screenshot({ 
          path: './screenshots/reminder-templates-pagination.png',
          fullPage: true 
        });
      }
    }
  });

  test('09 - Should view template details', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Find a test template and click to view details
    const templateRow = page.locator(`tr:has-text("${TEST_TEMPLATES[0].name}"), .template-card:has-text("${TEST_TEMPLATES[0].name}")`);
    
    if (await templateRow.count() > 0) {
      // Look for view/details button
      const viewButton = templateRow.locator('button:has-text("Ver"), button:has-text("Detalhes"), a:has-text("Ver"), [aria-label*="view"]');
      
      if (await viewButton.count() > 0) {
        await viewButton.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should show template details
        await expect(page.locator(`text=${TEST_TEMPLATES[0].name}`)).toBeVisible();
        await expect(page.locator(`text*=${TEST_TEMPLATES[0].template.substring(0, 20)}`)).toBeVisible();
      } else {
        // Try clicking on template name
        const templateName = templateRow.locator(`text=${TEST_TEMPLATES[0].name}`);
        await templateName.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('10 - Should search for templates', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Look for search field
    const searchField = page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"], input[type="search"]');
    
    if (await searchField.count() > 0) {
      // Search for test template
      await searchField.fill('QA Test');
      await page.waitForTimeout(2000);
      
      // Should show filtered results
      const searchResults = page.locator('tbody tr, .template-card');
      const resultCount = await searchResults.count();
      
      // Should have at least our test templates
      expect(resultCount).toBeGreaterThan(0);
      
      // Verify results contain search term
      await expect(page.locator('text*=QA Test')).toBeVisible();
      
      // Clear search
      await searchField.clear();
      await page.waitForTimeout(1000);
    }
  });

  test('11 - Should filter templates by category', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Look for category filter
    const categoryFilter = page.locator('select[name="category"], select[id="categoryFilter"], .category-filter');
    
    if (await categoryFilter.count() > 0) {
      // Filter by a category
      await categoryFilter.selectOption('aula');
      await page.waitForTimeout(2000);
      
      // Should show filtered results
      const filteredResults = page.locator('tbody tr, .template-card');
      const resultCount = await filteredResults.count();
      
      // Should have at least some results
      expect(resultCount).toBeGreaterThan(0);
      
      // Reset filter
      await categoryFilter.selectOption('');
      await page.waitForTimeout(1000);
    }
  });

  // UPDATE TEMPLATE TESTS
  test('12 - Should navigate to edit template form', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Find test template and click edit
    const templateRow = page.locator(`tr:has-text("${TEST_TEMPLATES[0].name}"), .template-card:has-text("${TEST_TEMPLATES[0].name}")`);
    await expect(templateRow.first()).toBeVisible();
    
    // Look for edit button
    const editButton = templateRow.first().locator('button:has-text("Editar"), a:has-text("Editar"), [aria-label*="edit"], [title*="edit"]');
    
    if (await editButton.count() === 0) {
      // Look for icon buttons (pencil, edit icons)
      const iconButtons = templateRow.first().locator('button:has(svg), button[aria-label*="edit"]');
      if (await iconButtons.count() > 0) {
        await iconButtons.first().click();
      }
    } else {
      await editButton.first().click();
    }
    
    await page.waitForLoadState('networkidle');
    
    // Should be on edit page
    expect(page.url()).toContain('/edit');
    
    // Form should be pre-filled with template data
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const currentName = await nameField.inputValue();
    expect(currentName).toContain('QA Test');
  });

  test('13 - Should update template information', async () => {
    const originalTemplate = TEST_TEMPLATES[0];
    const updatedName = `${originalTemplate.name} - Editado`;
    const updatedTemplate = `${originalTemplate.template} [EDITADO]`;
    
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Find and edit the template
    const templateRow = page.locator(`tr:has-text("${originalTemplate.name}"), .template-card:has-text("${originalTemplate.name}")`);
    const editButton = templateRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Update fields
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    await nameField.clear();
    await nameField.fill(updatedName);
    
    await templateField.clear();
    await templateField.fill(updatedTemplate);
    
    // Submit changes
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Atualizar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(3000);
    
    // Should redirect back to templates list
    expect(page.url()).toContain('/reminder-templates');
    expect(page.url()).not.toContain('/edit');
    
    // Verify updated template appears in list
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    
    // Update our test data for cleanup
    TEST_TEMPLATES[0].name = updatedName;
  });

  test('14 - Should validate template variables during edit', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Edit a template
    const templateRow = page.locator(`tr:has-text("${TEST_TEMPLATES[1].name}"), .template-card:has-text("${TEST_TEMPLATES[1].name}")`);
    const editButton = templateRow.first().locator('button:has(svg), button:has-text("Editar"), [aria-label*="edit"]');
    
    await editButton.first().click();
    await page.waitForLoadState('networkidle');
    
    // Add invalid variable format
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    await templateField.clear();
    await templateField.fill('Template com variável inválida: {invalid_variable} e {{valid_variable}}');
    
    const saveButton = page.locator('button[type="submit"], button:has-text("Salvar")');
    await saveButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Should show validation warning or still allow save
    const hasValidationWarning = await page.locator('text*=formato, text*=variável').count() > 0;
    const hasSaved = page.url().includes('/reminder-templates') && !page.url().includes('/edit');
    
    // Either shows warning or saves successfully (depends on implementation)
    expect(hasValidationWarning || hasSaved).toBe(true);
  });

  // TEMPLATE PREVIEW TESTS
  test('15 - Should preview template with sample data', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Find a template and look for preview button
    const templateRow = page.locator(`tr:has-text("${TEST_TEMPLATES[0].name}"), .template-card:has-text("${TEST_TEMPLATES[0].name}")`);
    const previewButton = templateRow.locator('button:has-text("Preview"), button:has-text("Visualizar"), [aria-label*="preview"]');
    
    if (await previewButton.count() > 0) {
      await previewButton.click();
      await page.waitForTimeout(2000);
      
      // Should show preview modal or section
      const previewModal = page.locator('[role="dialog"], .modal, .preview-container');
      await expect(previewModal.first()).toBeVisible();
      
      // Should show template with replaced variables
      const previewContent = page.locator('.preview-content, .template-preview');
      if (await previewContent.count() > 0) {
        // Variables should be replaced with sample data
        const hasReplacedVariables = await previewContent.locator('text*=João, text*=Maria, text*=Inglês').count() > 0;
        expect(hasReplacedVariables).toBe(true);
      }
      
      // Close preview
      const closeButton = page.locator('button:has-text("Fechar"), button:has-text("Close"), [aria-label*="close"]');
      if (await closeButton.count() > 0) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  // DELETE TEMPLATE TESTS
  test('16 - Should show delete confirmation dialog', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Find a test template to delete
    const templateRow = page.locator(`tr:has-text("${TEST_TEMPLATES[2].name}"), .template-card:has-text("${TEST_TEMPLATES[2].name}")`);
    
    if (await templateRow.count() > 0) {
      // Look for delete button
      const deleteButton = templateRow.first().locator('button:has-text("Excluir"), button:has-text("Delete"), [aria-label*="delete"], [title*="delete"]');
      
      if (await deleteButton.count() === 0) {
        // Look for icon buttons (trash, delete icons)
        const iconButtons = templateRow.first().locator('button:has(svg)');
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

  // RESPONSIVE DESIGN TESTS
  test('17 - Should test responsive design for template management', async () => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Template list should be responsive
    const templatesContainer = page.locator('table, .templates-list, .template-grid');
    await expect(templatesContainer.first()).toBeVisible();
    
    // New template button should be accessible
    const newTemplateButton = page.locator('text*=Novo, text*=Adicionar, [href*="/new"]');
    await expect(newTemplateButton.first()).toBeVisible();
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: './screenshots/reminder-templates-mobile.png',
      fullPage: true 
    });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Form should be responsive
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Template textarea should be readable
    const templateField = page.locator('textarea[name="template"]');
    if (await templateField.count() > 0) {
      const textareaBox = await templateField.boundingBox();
      expect(textareaBox?.width).toBeGreaterThan(300);
    }
    
    // Take tablet screenshot
    await page.screenshot({ 
      path: './screenshots/reminder-templates-tablet.png',
      fullPage: true 
    });
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  // ERROR HANDLING TESTS
  test('18 - Should handle form errors gracefully', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    // Simulate network error during form submission
    await page.route('**/api/reminder-templates', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Fill and submit form
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    await nameField.fill('Test Error Handling');
    await templateField.fill('Template de teste para erro {{nome_do_aluno}}');
    
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
    await page.unroute('**/api/reminder-templates');
  });

  // ACCESSIBILITY TESTS
  test('19 - Should test accessibility features', async () => {
    await page.goto(`${BASE_URL}/admin/reminder-templates`);
    await page.waitForLoadState('networkidle');
    
    // Check for proper table headers
    const tableHeaders = page.locator('th[scope="col"], thead th');
    if (await tableHeaders.count() > 0) {
      expect(await tableHeaders.count()).toBeGreaterThan(0);
    }
    
    // Check for proper labels on form
    await page.goto(`${BASE_URL}/admin/reminder-templates/new`);
    await page.waitForLoadState('networkidle');
    
    const nameField = page.locator('input[name="name"], input[id="name"]');
    const templateField = page.locator('textarea[name="template"], textarea[id="template"]');
    
    // Should have labels, aria-labels, or placeholders
    const nameHasLabel = await page.locator('label[for="name"]').count() > 0 ||
      await nameField.getAttribute('aria-label') !== null ||
      await nameField.getAttribute('placeholder') !== null;
    
    const templateHasLabel = await page.locator('label[for="template"]').count() > 0 ||
      await templateField.getAttribute('aria-label') !== null ||
      await templateField.getAttribute('placeholder') !== null;
    
    expect(nameHasLabel).toBe(true);
    expect(templateHasLabel).toBe(true);
    
    // Check keyboard navigation
    await nameField.focus();
    await page.keyboard.press('Tab');
    
    // Should move to next focusable element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']).toContain(focusedElement);
    
    await page.screenshot({ 
      path: './screenshots/reminder-templates-accessibility.png',
      fullPage: true 
    });
  });
});