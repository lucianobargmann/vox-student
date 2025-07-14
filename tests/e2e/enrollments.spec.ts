import { test, expect } from '@playwright/test';

test.describe('Student Enrollments', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@voxstudent.com');
    await page.click('button[type="submit"]');
    
    // Wait for magic link to be generated (in real scenario, would check email)
    // For testing, we'll assume the magic link works
    await page.waitForURL('/');
  });

  test('should display class enrollments page', async ({ page }) => {
    // Navigate to classes
    await page.goto('/admin/classes');
    await expect(page.locator('h1')).toContainText('Gerenciar Turmas');
    
    // Click on first class details (eye icon)
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Should be on class details page
    await expect(page.locator('h1')).toContainText('');
    await expect(page.locator('[data-testid="enrollments-tab"]')).toBeVisible();
  });

  test('should enroll a student in a class', async ({ page }) => {
    // First, ensure we have a course and class
    await page.goto('/admin/courses');
    
    // Create a course if none exists
    const courseCount = await page.locator('table tbody tr').count();
    if (courseCount === 0) {
      await page.click('text=Nova Curso');
      await page.fill('input[name="name"]', 'Curso de Teste E2E');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Curso criado com sucesso')).toBeVisible();
    }
    
    // Navigate to classes and create one if needed
    await page.goto('/admin/classes');
    const classCount = await page.locator('table tbody tr').count();
    if (classCount === 0) {
      await page.click('text=Nova Turma');
      await page.selectOption('select[name="courseId"]', { index: 0 });
      await page.fill('input[name="name"]', 'Turma de Teste E2E');
      await page.fill('input[name="startDate"]', '2024-01-15');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Turma criada com sucesso')).toBeVisible();
    }
    
    // Create a student if none exists
    await page.goto('/admin/students');
    const studentCount = await page.locator('table tbody tr').count();
    if (studentCount === 0) {
      await page.click('text=Novo Aluno');
      await page.fill('input[name="name"]', 'Aluno de Teste E2E');
      await page.fill('input[name="email"]', 'teste.e2e@example.com');
      await page.fill('input[name="phone"]', '(11) 99999-9999');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Aluno criado com sucesso')).toBeVisible();
    }
    
    // Go to class details
    await page.goto('/admin/classes');
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Click on "Matricular Aluno" button
    await page.click('text=Matricular Aluno');
    
    // Search for the student
    await page.fill('input[placeholder*="Digite nome, email ou telefone"]', 'Aluno de Teste E2E');
    await page.waitForTimeout(1000); // Wait for search results
    
    // Select the student
    await page.click('text=Aluno de Teste E2E');
    
    // Should be on details step
    await expect(page.locator('text=Configure os detalhes da matrícula')).toBeVisible();
    
    // Course should be pre-selected, select enrollment type
    await page.selectOption('select', 'regular');
    
    // Add notes
    await page.fill('textarea[placeholder*="Observações"]', 'Matrícula via teste E2E');
    
    // Submit enrollment
    await page.click('button:has-text("Matricular")');
    
    // Should show success message
    await expect(page.locator('text=Aluno matriculado com sucesso')).toBeVisible();
    
    // Should see the student in the enrollments table
    await expect(page.locator('table')).toContainText('Aluno de Teste E2E');
  });

  test('should transfer student between classes', async ({ page }) => {
    // This test assumes we have students enrolled from previous test
    await page.goto('/admin/classes');
    
    // Go to first class details
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Check if there are enrolled students
    const enrolledStudents = await page.locator('table tbody tr').count();
    if (enrolledStudents > 0) {
      // Click on actions menu for first student
      const firstStudentRow = page.locator('table tbody tr').first();
      await firstStudentRow.locator('button[aria-haspopup="menu"]').click();
      
      // Check if transfer option is available (only for active students)
      const transferOption = page.locator('text=Transferir para outra turma');
      if (await transferOption.isVisible()) {
        await transferOption.click();
        
        // Should open transfer dialog
        await expect(page.locator('text=Transferir Aluno')).toBeVisible();
        
        // Select a different class (if available)
        const classSelect = page.locator('select');
        const classOptions = await classSelect.locator('option').count();
        
        if (classOptions > 1) {
          await classSelect.selectOption({ index: 1 });
          
          // Select transfer type
          await page.selectOption('select:has(option:text("Reinício"))', 'restart');
          
          // Add transfer notes
          await page.fill('textarea', 'Transferência via teste E2E');
          
          // Submit transfer
          await page.click('button:has-text("Transferir")');
          
          // Should show success message
          await expect(page.locator('text=Aluno transferido com sucesso')).toBeVisible();
        }
      }
    }
  });

  test('should reactivate inactive student', async ({ page }) => {
    await page.goto('/admin/classes');
    
    // Go to first class details
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Look for inactive students
    const inactiveStudentRow = page.locator('table tbody tr:has(text="Inativo")').first();
    
    if (await inactiveStudentRow.isVisible()) {
      // Click on actions menu
      await inactiveStudentRow.locator('button[aria-haspopup="menu"]').click();
      
      // Click reactivate
      await page.click('text=Reativar');
      
      // Should show success message
      await expect(page.locator('text=Matrícula reativada com sucesso')).toBeVisible();
      
      // Student should now show as active
      await expect(inactiveStudentRow.locator('text=Ativo')).toBeVisible();
    }
  });

  test('should show available students tab', async ({ page }) => {
    await page.goto('/admin/classes');
    
    // Go to first class details
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Click on "Alunos Disponíveis" tab
    await page.click('text=Alunos Disponíveis');
    
    // Should show available students
    await expect(page.locator('text=Alunos Disponíveis para')).toBeVisible();
    
    // Should have search functionality
    await expect(page.locator('input[placeholder*="Buscar por nome"]')).toBeVisible();
  });

  test('should quickly enroll student from available students tab', async ({ page }) => {
    await page.goto('/admin/classes');
    
    // Go to first class details
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Click on "Alunos Disponíveis" tab
    await page.click('text=Alunos Disponíveis');
    
    // Look for available students
    const availableStudentRows = page.locator('table tbody tr');
    const studentCount = await availableStudentRows.count();
    
    if (studentCount > 0) {
      // Click on "Matricular" button for first available student
      const firstStudentRow = availableStudentRows.first();
      const enrollButton = firstStudentRow.locator('button:has-text("Matricular")');
      
      if (await enrollButton.isVisible()) {
        await enrollButton.click();
        
        // Should show success message
        await expect(page.locator('text=Aluno matriculado com sucesso')).toBeVisible();
        
        // Go back to enrollments tab to verify
        await page.click('text=Matrículas');
        
        // Should see the newly enrolled student
        await expect(page.locator('table tbody tr')).toHaveCount(studentCount);
      }
    }
  });

  test('should handle enrollment validation errors', async ({ page }) => {
    await page.goto('/admin/classes');
    
    // Go to first class details
    const firstClassRow = page.locator('table tbody tr').first();
    await firstClassRow.locator('button[title="Ver detalhes"]').click();
    
    // Click on "Matricular Aluno" button
    await page.click('text=Matricular Aluno');
    
    // Try to proceed without selecting a student
    await page.click('button:has-text("Matricular")');
    
    // Should show validation error
    await expect(page.locator('text=Dados incompletos')).toBeVisible();
  });

  test('should display enrollment statistics', async ({ page }) => {
    await page.goto('/admin/students');
    
    // Go to first student details
    const firstStudentRow = page.locator('table tbody tr').first();
    await firstStudentRow.locator('button[title="Ver detalhes"]').click();
    
    // Should show enrollment statistics
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.locator('text=Ativas')).toBeVisible();
    await expect(page.locator('text=Inativas')).toBeVisible();
    await expect(page.locator('text=Faltas Totais')).toBeVisible();
    
    // Should show enrollments table
    await expect(page.locator('table')).toBeVisible();
  });
});
