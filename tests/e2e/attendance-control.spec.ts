import { test, expect } from '@playwright/test';

// Test data
const testCourse = {
  name: 'Curso de Teste E2E',
  description: 'Curso criado para testes automatizados',
  duration: '40',
  numberOfLessons: '12',
  price: '299.90'
};

const testClass = {
  name: 'Turma Teste E2E',
  description: 'Turma criada para testes automatizados',
  startDate: '2024-01-15', // Monday
  classTime: '19:00',
  maxStudents: '20'
};

const testStudent = {
  name: 'Aluno Teste E2E',
  email: 'aluno.teste@example.com',
  phone: '(11) 99999-9999'
};

test.describe('Attendance Control System', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/');
  });

  test('Course Creation with Number of Lessons', async ({ page }) => {
    // Navigate to courses page
    await page.click('text=Gerenciar Cursos');
    await page.waitForURL('/admin/courses');

    // Click new course button
    await page.click('text=Novo Curso');
    await page.waitForURL('/admin/courses/new');

    // Fill course form
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('textarea[id="description"]', testCourse.description);
    await page.fill('input[id="duration"]', testCourse.duration);
    await page.fill('input[id="numberOfLessons"]', testCourse.numberOfLessons);
    await page.fill('input[id="price"]', testCourse.price);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect and success message
    await page.waitForURL('/admin/courses');
    await expect(page.locator('text=Curso criado com sucesso')).toBeVisible();

    // Verify course appears in list with correct data
    const courseRow = page.locator(`text=${testCourse.name}`).first();
    await expect(courseRow).toBeVisible();

    // Click to edit and verify numberOfLessons was saved
    await courseRow.click();
    await page.waitForURL(/\/admin\/courses\/.*\/edit/);
    
    const numberOfLessonsInput = page.locator('input[id="numberOfLessons"]');
    await expect(numberOfLessonsInput).toHaveValue(testCourse.numberOfLessons);
  });

  test('Class Creation with Auto-calculated End Date', async ({ page }) => {
    // First create a course (prerequisite)
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', testCourse.numberOfLessons);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');

    // Navigate to classes page
    await page.click('text=Gerenciar Turmas');
    await page.waitForURL('/admin/classes');

    // Click new class button
    await page.click('text=Nova Turma');
    await page.waitForURL('/admin/classes/new');

    // Fill class form
    await page.fill('input[id="name"]', testClass.name);
    await page.fill('textarea[id="description"]', testClass.description);
    
    // Select course
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    
    // Set start date
    await page.fill('input[id="startDate"]', testClass.startDate);
    
    // Set class time
    await page.fill('input[id="classTime"]', testClass.classTime);
    
    // Fill max students
    await page.fill('input[id="maxStudents"]', testClass.maxStudents);

    // Verify end date was auto-calculated (12 lessons = 11 weeks after start date)
    const endDateInput = page.locator('input[id="endDate"]');
    await expect(endDateInput).toHaveValue('2024-04-01'); // 11 weeks after 2024-01-15

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect and success message
    await page.waitForURL('/admin/classes');
    await expect(page.locator('text=Turma criada com sucesso')).toBeVisible();
  });

  test('Lesson Generation', async ({ page }) => {
    // Create course and class first
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', testCourse.numberOfLessons);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');

    await page.goto('/admin/classes/new');
    await page.fill('input[id="name"]', testClass.name);
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    await page.fill('input[id="startDate"]', testClass.startDate);
    await page.fill('input[id="classTime"]', testClass.classTime);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/classes');

    // Navigate to class edit page
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);

    // Verify lesson calendar is visible and shows correct number of lessons
    await expect(page.locator('text=Calendário de Aulas')).toBeVisible();
    await expect(page.locator('text=12 aulas programadas')).toBeVisible();

    // Verify lessons are generated with correct weekly recurrence
    const lessons = page.locator('[data-testid="lesson-item"]');
    await expect(lessons).toHaveCount(12);

    // Check first lesson date (should be the start date)
    const firstLesson = lessons.first();
    await expect(firstLesson).toContainText('15/01/2024');
    await expect(firstLesson).toContainText('19:00');

    // Check second lesson date (should be one week later)
    const secondLesson = lessons.nth(1);
    await expect(secondLesson).toContainText('22/01/2024');
  });

  test('Class Edit Page Layout', async ({ page }) => {
    // Create course and class first
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', testCourse.numberOfLessons);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');

    await page.goto('/admin/classes/new');
    await page.fill('input[id="name"]', testClass.name);
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    await page.fill('input[id="startDate"]', testClass.startDate);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/classes');

    // Navigate to class edit page
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);

    // Verify split layout exists
    const gridContainer = page.locator('.grid.gap-8.lg\\:grid-cols-2');
    await expect(gridContainer).toBeVisible();

    // Verify student management section (left side)
    const studentSection = gridContainer.locator('div').first();
    await expect(studentSection.locator('text=Gerenciar Alunos')).toBeVisible();

    // Verify lesson calendar section (right side)
    const lessonSection = gridContainer.locator('div').nth(1);
    await expect(lessonSection.locator('text=Calendário de Aulas')).toBeVisible();
  });

  test('Daily Classes List', async ({ page }) => {
    // Navigate to attendance page
    await page.click('text=Controle de Presença');
    await page.waitForURL('/admin/attendance');

    // Should show today's date in the header
    const today = new Date().toLocaleDateString('pt-BR');
    await expect(page.locator('text=Controle de Presença')).toBeVisible();

    // If no classes today, should show empty state
    const emptyState = page.locator('text=Nenhuma aula hoje');
    const classCards = page.locator('[data-testid="lesson-card"]');

    // Either empty state or class cards should be visible
    await expect(emptyState.or(classCards.first())).toBeVisible();
  });

  test('Attendance Marking', async ({ page }) => {
    // Create course, class, and student first
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', testCourse.numberOfLessons);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');

    await page.goto('/admin/classes/new');
    await page.fill('input[id="name"]', testClass.name);
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    await page.fill('input[id="startDate"]', new Date().toISOString().split('T')[0]); // Today
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/classes');

    // Create a student
    await page.goto('/admin/students/new');
    await page.fill('input[id="name"]', testStudent.name);
    await page.fill('input[id="email"]', testStudent.email);
    await page.fill('input[id="phone"]', testStudent.phone);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/students');

    // Enroll student in class
    await page.goto('/admin/classes');
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);
    await page.click('text=Matricular Aluno');
    await page.fill('input[placeholder="Buscar aluno..."]', testStudent.name);
    await page.click(`text=${testStudent.name}`);
    await page.click('text=Continuar');
    await page.click('text=Matricular');

    // Go to attendance page
    await page.goto('/admin/attendance');

    // Should see today's lesson
    const lessonCard = page.locator('[data-testid="lesson-card"]').first();
    await expect(lessonCard).toBeVisible();

    // Click to mark attendance
    await lessonCard.locator('text=Marcar Presença').click();
    await page.waitForURL(/\/admin\/attendance\/.*/);

    // Verify student appears in attendance list
    await expect(page.locator(`text=${testStudent.name}`)).toBeVisible();

    // Mark student as present
    const studentRow = page.locator(`text=${testStudent.name}`).locator('..').locator('..');
    await studentRow.locator('text=Presente').click();

    // Save attendance
    await page.click('text=Salvar Presença');

    // Should redirect back to attendance page with success message
    await page.waitForURL('/admin/attendance');
    await expect(page.locator('text=Presença salva com sucesso')).toBeVisible();

    // Verify attendance was saved (lesson should show 1/1 present)
    await expect(page.locator('text=1/1 presentes')).toBeVisible();
  });

  test('Weekly Class Recurrence', async ({ page }) => {
    // Create course
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', '4'); // Just 4 lessons for easier testing
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');

    // Create class starting on Wednesday
    await page.goto('/admin/classes/new');
    await page.fill('input[id="name"]', testClass.name);
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    await page.fill('input[id="startDate"]', '2024-01-17'); // Wednesday
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/classes');

    // Navigate to class edit page
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);

    // Verify all lessons are on Wednesdays
    const lessons = page.locator('[data-testid="lesson-item"]');
    await expect(lessons).toHaveCount(4);

    // Check that all lessons are on Wednesday (quarta-feira in Portuguese)
    for (let i = 0; i < 4; i++) {
      const lesson = lessons.nth(i);
      await expect(lesson).toContainText('quarta-feira');
    }

    // Verify specific dates
    await expect(lessons.nth(0)).toContainText('17/01/2024'); // First Wednesday
    await expect(lessons.nth(1)).toContainText('24/01/2024'); // Second Wednesday
    await expect(lessons.nth(2)).toContainText('31/01/2024'); // Third Wednesday
    await expect(lessons.nth(3)).toContainText('07/02/2024'); // Fourth Wednesday
  });

  test('Integration Flow', async ({ page }) => {
    // Complete flow: create course → create class → generate lessons → mark attendance → view results
    
    // 1. Create course
    await page.goto('/admin/courses/new');
    await page.fill('input[id="name"]', testCourse.name);
    await page.fill('input[id="numberOfLessons"]', '2'); // Just 2 lessons for quick test
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/courses');
    await expect(page.locator('text=Curso criado com sucesso')).toBeVisible();

    // 2. Create class
    await page.goto('/admin/classes/new');
    await page.fill('input[id="name"]', testClass.name);
    await page.click('[role="combobox"]');
    await page.click(`text=${testCourse.name}`);
    await page.fill('input[id="startDate"]', new Date().toISOString().split('T')[0]); // Today
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/classes');
    await expect(page.locator('text=Turma criada com sucesso')).toBeVisible();

    // 3. Verify lessons were generated
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);
    await expect(page.locator('text=2 aulas programadas')).toBeVisible();

    // 4. Create and enroll student
    await page.goto('/admin/students/new');
    await page.fill('input[id="name"]', testStudent.name);
    await page.fill('input[id="email"]', testStudent.email);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/students');

    await page.goto('/admin/classes');
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);
    await page.click('text=Matricular Aluno');
    await page.fill('input[placeholder="Buscar aluno..."]', testStudent.name);
    await page.click(`text=${testStudent.name}`);
    await page.click('text=Continuar');
    await page.click('text=Matricular');

    // 5. Mark attendance
    await page.goto('/admin/attendance');
    const lessonCard = page.locator('[data-testid="lesson-card"]').first();
    await lessonCard.locator('text=Marcar Presença').click();
    await page.waitForURL(/\/admin\/attendance\/.*/);
    
    const studentRow = page.locator(`text=${testStudent.name}`).locator('..').locator('..');
    await studentRow.locator('text=Presente').click();
    await page.click('text=Salvar Presença');

    // 6. View results
    await page.waitForURL('/admin/attendance');
    await expect(page.locator('text=Presença salva com sucesso')).toBeVisible();
    await expect(page.locator('text=1/1 presentes')).toBeVisible();

    // Verify in class edit page
    await page.goto('/admin/classes');
    await page.click(`text=${testClass.name}`);
    await page.waitForURL(/\/admin\/classes\/.*\/edit/);
    
    // First lesson should show as completed with 1 present
    const firstLesson = page.locator('[data-testid="lesson-item"]').first();
    await expect(firstLesson).toContainText('Concluída');
    await expect(firstLesson).toContainText('1 presentes');
  });
});
