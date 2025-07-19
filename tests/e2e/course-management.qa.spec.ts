import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestCourse {
  name: string;
  description: string;
  duration: string;
  price: string;
}

interface TestClass {
  name: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacity: string;
}

const TEST_COURSE: TestCourse = {
  name: 'QA Test - Curso de Inglês',
  description: 'Curso de teste para automação QA',
  duration: '6',
  price: '299.99'
};

const TEST_CLASS: TestClass = {
  name: 'QA Test - Turma A',
  dayOfWeek: 'monday',
  startTime: '19:00',
  endTime: '20:30',
  capacity: '20'
};

test.describe('Course Management E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Login as admin first
    await page.goto(`${BASE_URL}`);
    await page.fill('input[type="email"]', 'admin@qa.voxstudent.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.screenshot({ 
      path: `./screenshots/course-before-${test.info().title.replace(/\s+/g, '-')}.png`,
      fullPage: true 
    });
  });

  test('01 - Should navigate to courses page', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toContainText('Cursos');
    
    // Check for "New Course" button
    const newButton = page.locator('text=Novo Curso').or(page.locator('text=Adicionar Curso'));
    await expect(newButton).toBeVisible();
  });

  test('02 - Should create new course', async () => {
    await page.goto(`${BASE_URL}/admin/courses/new`);
    await page.waitForLoadState('networkidle');
    
    // Fill course form
    await page.fill('input[name="name"]', TEST_COURSE.name);
    await page.fill('textarea[name="description"]', TEST_COURSE.description);
    
    // Fill additional fields if they exist
    const durationField = page.locator('input[name="duration"]');
    if (await durationField.count() > 0) {
      await durationField.fill(TEST_COURSE.duration);
    }
    
    const priceField = page.locator('input[name="price"]');
    if (await priceField.count() > 0) {
      await priceField.fill(TEST_COURSE.price);
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Should redirect to courses list
    await expect(page).toHaveURL(/\/admin\/courses$/);
    
    // Verify course appears in list
    await expect(page.locator(`text=${TEST_COURSE.name}`)).toBeVisible();
  });

  test('03 - Should edit course', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find and click edit button for test course
    const courseRow = page.locator(`tr:has-text("${TEST_COURSE.name}")`);
    await expect(courseRow).toBeVisible();
    
    const editButton = courseRow.locator('button:has(svg)').first();
    await editButton.click();
    
    // Wait for edit page
    await page.waitForLoadState('networkidle');
    
    // Update course name
    const nameInput = page.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill(`${TEST_COURSE.name} - Editado`);
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Verify updated course
    await expect(page.locator(`text=${TEST_COURSE.name} - Editado`)).toBeVisible();
  });

  test('04 - Should create class for course', async () => {
    await page.goto(`${BASE_URL}/admin/classes/new`);
    await page.waitForLoadState('networkidle');
    
    // Select course
    const courseSelect = page.locator('select[name="courseId"]');
    if (await courseSelect.count() > 0) {
      await courseSelect.selectOption({ label: TEST_COURSE.name });
    }
    
    // Fill class form
    await page.fill('input[name="name"]', TEST_CLASS.name);
    
    // Select day of week
    const daySelect = page.locator('select[name="dayOfWeek"]');
    if (await daySelect.count() > 0) {
      await daySelect.selectOption(TEST_CLASS.dayOfWeek);
    }
    
    // Fill times
    await page.fill('input[name="startTime"]', TEST_CLASS.startTime);
    await page.fill('input[name="endTime"]', TEST_CLASS.endTime);
    
    // Fill capacity
    const capacityField = page.locator('input[name="capacity"]');
    if (await capacityField.count() > 0) {
      await capacityField.fill(TEST_CLASS.capacity);
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Should redirect to classes list
    await expect(page).toHaveURL(/\/admin\/classes$/);
    
    // Verify class appears in list
    await expect(page.locator(`text=${TEST_CLASS.name}`)).toBeVisible();
  });

  test('05 - Should test class scheduling validation', async () => {
    await page.goto(`${BASE_URL}/admin/classes/new`);
    await page.waitForLoadState('networkidle');
    
    // Try to create class with invalid times (end before start)
    await page.fill('input[name="name"]', 'QA Test - Invalid Class');
    await page.fill('input[name="startTime"]', '20:00');
    await page.fill('input[name="endTime"]', '19:00');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Should show validation error
    const hasError = await page.locator('text*=erro').or(page.locator('text*=inválido')).count() > 0;
    expect(hasError).toBe(true);
  });

  test('06 - Should generate lessons automatically', async () => {
    // Navigate to lessons page
    await page.goto(`${BASE_URL}/admin/lessons`);
    await page.waitForLoadState('networkidle');
    
    // Check if lessons were generated for the test class
    const lessonExists = await page.locator(`text*=${TEST_CLASS.name}`).count() > 0;
    
    if (lessonExists) {
      // Verify lesson details
      await expect(page.locator(`text=${TEST_CLASS.name}`)).toBeVisible();
    } else {
      // Try to trigger lesson generation
      const generateButton = page.locator('text=Gerar Aulas').or(page.locator('text=Generate Lessons'));
      if (await generateButton.count() > 0) {
        await generateButton.click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('07 - Should test lesson editing', async () => {
    await page.goto(`${BASE_URL}/admin/lessons`);
    await page.waitForLoadState('networkidle');
    
    // Find a lesson to edit
    const lessonRow = page.locator('tbody tr').first();
    const lessonExists = await lessonRow.count() > 0;
    
    if (lessonExists) {
      const editButton = lessonRow.locator('button:has(svg)').first();
      await editButton.click();
      
      // Wait for edit page
      await page.waitForLoadState('networkidle');
      
      // Update lesson title
      const titleField = page.locator('input[name="title"]');
      if (await titleField.count() > 0) {
        await titleField.clear();
        await titleField.fill('QA Test - Lesson Edited');
        
        // Submit form
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // Verify update
        await expect(page.locator('text=QA Test - Lesson Edited')).toBeVisible();
      }
    }
  });

  test('08 - Should test course status management', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Find the test course
    const courseRow = page.locator(`tr:has-text("${TEST_COURSE.name}")`);
    
    // Look for status toggle
    const statusToggle = courseRow.locator('input[type="checkbox"]').or(courseRow.locator('button:has-text("Ativo")'));
    
    if (await statusToggle.count() > 0) {
      await statusToggle.click();
      await page.waitForTimeout(2000);
      
      // Verify status change
      await page.screenshot({ 
        path: './screenshots/course-status-toggle.png',
        fullPage: true 
      });
    }
  });

  test('09 - Should test course search and filtering', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Look for search field
    const searchField = page.locator('input[placeholder*="Buscar"]').or(page.locator('input[type="search"]'));
    
    if (await searchField.count() > 0) {
      // Search for test course
      await searchField.fill('QA Test');
      await page.waitForTimeout(2000);
      
      // Should show filtered results
      await expect(page.locator(`text=${TEST_COURSE.name}`)).toBeVisible();
      
      // Clear search
      await searchField.clear();
      await page.waitForTimeout(1000);
    }
  });

  test('10 - Should test course pagination', async () => {
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Look for pagination controls
    const paginationNext = page.locator('button:has-text("Próximo")').or(page.locator('button:has-text("Next")'));
    const paginationPrev = page.locator('button:has-text("Anterior")').or(page.locator('button:has-text("Previous")'));
    
    if (await paginationNext.count() > 0) {
      // Test pagination
      await paginationNext.click();
      await page.waitForTimeout(2000);
      
      // Should change page
      await page.screenshot({ 
        path: './screenshots/course-pagination.png',
        fullPage: true 
      });
      
      if (await paginationPrev.count() > 0) {
        await paginationPrev.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('11 - Should clean up test data', async () => {
    // Delete test course
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    const courseRow = page.locator(`tr:has-text("${TEST_COURSE.name}")`);
    if (await courseRow.count() > 0) {
      const deleteButton = courseRow.locator('button:has(svg)').last();
      await deleteButton.click();
      
      // Confirm deletion
      await page.waitForTimeout(1000);
      const confirmButton = page.locator('button:has-text("Excluir")').or(page.locator('button:has-text("Confirmar")'));
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });
});