import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-utils';

// Test data
const testCourse = {
  name: 'Curso de Teste E2E',
  description: 'Descrição do curso de teste para e2e',
  duration: '40',
  price: '299.90',
  allowsMakeup: true
};

const updatedCourse = {
  name: 'Curso de Teste E2E Atualizado',
  description: 'Descrição atualizada do curso de teste',
  duration: '60',
  price: '399.90',
  allowsMakeup: false,
  isActive: false
};

test.describe('Courses CRUD', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.mockAuth('super_admin');
  });

  test('should display courses list page', async ({ page }) => {
    const sampleCourse = helpers.createSampleCourse();
    await helpers.mockCoursesAPI([sampleCourse]);

    await page.goto('/admin/courses');

    // Check page title
    await expect(page.locator('h1')).toContainText('Gerenciar Cursos');

    // Check if course is displayed
    await expect(page.locator('text=Academy')).toBeVisible();
    await expect(page.locator('text=Curso básico de canto')).toBeVisible();
    await expect(page.locator('text=40h')).toBeVisible();
    await expect(page.locator('text=R$ 299,90')).toBeVisible();

    // Check action buttons
    await expect(page.locator('button:has-text("Novo Curso")')).toBeVisible();
    await expect(page.locator('svg[data-testid="edit-icon"]').first()).toBeVisible();
    await expect(page.locator('svg[data-testid="delete-icon"]').first()).toBeVisible();
  });

  test('should create a new course', async ({ page }) => {
    let createdCourse: any = null;

    await helpers.mockCoursesAPI([]);
    await helpers.mockCourseCreation((data) => {
      createdCourse = {
        id: 'new-course-id',
        ...data,
        createdAt: new Date().toISOString(),
        isActive: true
      };
      return createdCourse;
    });

    await page.goto('/admin/courses');

    // Click "Novo Curso" button
    await page.click('button:has-text("Novo Curso")');

    // Verify we're on the new course page
    await expect(page.locator('h1')).toContainText('Novo Curso');

    // Fill the form using helper
    await helpers.fillCourseForm(testCourse);

    // Submit the form
    await page.click('button:has-text("Salvar Curso")');

    // Verify the course was created with correct data
    expect(createdCourse).toBeTruthy();
    expect(createdCourse.name).toBe(testCourse.name);
    expect(createdCourse.description).toBe(testCourse.description);
    expect(createdCourse.duration).toBe(parseInt(testCourse.duration));
    expect(createdCourse.price).toBe(parseFloat(testCourse.price));
    expect(createdCourse.allowsMakeup).toBe(testCourse.allowsMakeup);
  });

  test('should edit an existing course', async ({ page }) => {
    const existingCourse = {
      id: 'course-1',
      name: 'Academy',
      description: 'Curso básico de canto',
      duration: 40,
      price: 299.90,
      allowsMakeup: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    let updatedCourseData: any = null;

    // Mock the courses list API
    await page.route('/api/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [existingCourse] })
      });
    });

    // Mock the individual course API
    await page.route('/api/courses/course-1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: existingCourse })
        });
      } else if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        updatedCourseData = {
          ...existingCourse,
          ...requestBody
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: updatedCourseData })
        });
      }
    });

    await page.goto('/admin/courses');
    
    // Click edit button for the course
    await page.click('button[aria-label="Edit"]');
    
    // Verify we're on the edit course page
    await expect(page.locator('h1')).toContainText('Editar Curso');
    
    // Verify form is pre-filled
    await expect(page.locator('input[id="name"]')).toHaveValue(existingCourse.name);
    await expect(page.locator('textarea[id="description"]')).toHaveValue(existingCourse.description);
    
    // Update the form
    await page.fill('input[id="name"]', updatedCourse.name);
    await page.fill('textarea[id="description"]', updatedCourse.description);
    await page.fill('input[id="duration"]', updatedCourse.duration);
    await page.fill('input[id="price"]', updatedCourse.price);
    
    if (!updatedCourse.allowsMakeup) {
      await page.uncheck('input[id="allowsMakeup"]');
    }
    
    if (!updatedCourse.isActive) {
      await page.uncheck('input[id="isActive"]');
    }
    
    // Submit the form
    await page.click('button:has-text("Salvar Alterações")');
    
    // Verify the course was updated with correct data
    expect(updatedCourseData).toBeTruthy();
    expect(updatedCourseData.name).toBe(updatedCourse.name);
    expect(updatedCourseData.description).toBe(updatedCourse.description);
    expect(updatedCourseData.duration).toBe(parseInt(updatedCourse.duration));
    expect(updatedCourseData.price).toBe(parseFloat(updatedCourse.price));
    expect(updatedCourseData.allowsMakeup).toBe(updatedCourse.allowsMakeup);
    expect(updatedCourseData.isActive).toBe(updatedCourse.isActive);
  });

  test('should delete a course', async ({ page }) => {
    const existingCourse = {
      id: 'course-1',
      name: 'Academy',
      description: 'Curso básico de canto',
      duration: 40,
      price: 299.90,
      allowsMakeup: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    let deleteRequested = false;

    // Mock the courses list API
    await page.route('/api/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [existingCourse] })
      });
    });

    // Mock the delete API
    await page.route('/api/courses/course-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } })
        });
      }
    });

    await page.goto('/admin/courses');
    
    // Set up dialog handler for confirmation
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Tem certeza que deseja excluir o curso "Academy"?');
      await dialog.accept();
    });
    
    // Click delete button
    await page.click('button[aria-label="Delete"]');
    
    // Verify delete was requested
    expect(deleteRequested).toBe(true);
  });

  test('should search courses', async ({ page }) => {
    const courses = [
      {
        id: 'course-1',
        name: 'Academy',
        description: 'Curso básico de canto',
        duration: 40,
        price: 299.90,
        allowsMakeup: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        _count: { classes: 2, enrollments: 15 }
      },
      {
        id: 'course-2',
        name: 'Master',
        description: 'Curso avançado de canto',
        duration: 60,
        price: 499.90,
        allowsMakeup: false,
        isActive: true,
        createdAt: '2024-01-02T00:00:00.000Z',
        _count: { classes: 1, enrollments: 8 }
      }
    ];

    let searchTerm = '';

    // Mock the courses API with search
    await page.route('/api/courses*', async (route) => {
      const url = new URL(route.request().url());
      searchTerm = url.searchParams.get('search') || '';
      
      const filteredCourses = searchTerm 
        ? courses.filter(course => 
            course.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : courses;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: filteredCourses })
      });
    });

    await page.goto('/admin/courses');
    
    // Initially should show all courses
    await expect(page.locator('text=Academy')).toBeVisible();
    await expect(page.locator('text=Master')).toBeVisible();
    
    // Search for "Academy"
    await page.fill('input[placeholder="Buscar cursos..."]', 'Academy');
    await page.click('button:has-text("Buscar")');
    
    // Verify search was performed
    expect(searchTerm).toBe('Academy');
  });

  test('should handle form validation', async ({ page }) => {
    // Mock the courses list API
    await page.route('/api/courses', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Nome do curso é obrigatório (mínimo 2 caracteres)' })
        });
      }
    });

    await page.goto('/admin/courses/new');
    
    // Try to submit form without required fields
    await page.click('button:has-text("Salvar Curso")');
    
    // Check HTML5 validation
    const nameInput = page.locator('input[id="name"]');
    await expect(nameInput).toHaveAttribute('required');
    
    // Fill with invalid data (too short name)
    await page.fill('input[id="name"]', 'A');
    await page.click('button:has-text("Salvar Curso")');
    
    // Should show error message
    await expect(page.locator('text=Nome do curso é obrigatório (mínimo 2 caracteres)')).toBeVisible();
  });
});
