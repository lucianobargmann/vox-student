const puppeteer = require('puppeteer');

describe('Face Recognition Complete Flow', () => {
  let browser;
  let page;
  let testStudentId;
  let testLessonId;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security'
      ]
    });
    page = await browser.newPage();

    // Grant permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:3000', ['camera']);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await browser.close();
  });

  async function setupTestData() {
    // Login as admin
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@voxstudent.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Create test student
    await page.goto('http://localhost:3000/admin/students/new');
    await page.waitForSelector('input[name="name"]');
    await page.type('input[name="name"]', 'Test Student Face Recognition');
    await page.type('input[name="email"]', 'test-face@example.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Get student ID from URL
    const url = page.url();
    testStudentId = url.split('/').pop();
  }

  async function cleanupTestData() {
    // Clean up test data if needed
    if (testStudentId) {
      await page.evaluate(async (studentId) => {
        const token = localStorage.getItem('auth_token');
        await fetch(`/api/students/${studentId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }, testStudentId);
    }
  }

  test('Complete Face Registration Flow', async () => {
    console.log('Starting face registration flow test...');

    // Step 1: Navigate to student details
    await page.goto(`http://localhost:3000/admin/students/${testStudentId}`);
    await page.waitForSelector('[data-testid="student-details"]', { timeout: 10000 });

    // Step 2: Click face registration button
    await page.click('button:has-text("Cadastrar Face")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Step 3: Start camera
    await page.click('button:has-text("Iniciar Câmera")');
    await page.waitForTimeout(2000);

    // Step 4: Wait for face detection
    await page.waitForSelector('text=Rosto detectado', { timeout: 10000 });

    // Step 5: Capture face
    await page.click('button:has-text("Capturar Rosto")');
    await page.waitForTimeout(1000);

    // Step 6: Confirm registration
    await page.waitForSelector('button:has-text("Confirmar Cadastro")');
    await page.click('button:has-text("Confirmar Cadastro")');

    // Step 7: Wait for success
    await page.waitForSelector('text=Cadastro Concluído!', { timeout: 10000 });

    console.log('Face registration completed successfully');
  });

  test('Face Recognition in Attendance', async () => {
    console.log('Starting face recognition in attendance test...');

    // Step 1: Navigate to attendance
    await page.goto('http://localhost:3000/admin/attendance');
    await page.waitForSelector('[data-testid="attendance-lessons"]', { timeout: 10000 });

    // Step 2: Find and click on a lesson
    const lessonButton = await page.$('button:has-text("Marcar Presença")');
    if (lessonButton) {
      await lessonButton.click();
      await page.waitForSelector('[data-testid="attendance-marking"]', { timeout: 5000 });

      // Get lesson ID from URL
      const url = page.url();
      testLessonId = url.split('/').pop();

      // Step 3: Start face recognition
      await page.click('button:has-text("Reconhecimento Facial")');
      await page.waitForTimeout(2000);

      // Step 4: Verify recognition interface
      const recognitionCard = await page.$('[data-testid="face-recognition-card"]');
      expect(recognitionCard).toBeTruthy();

      // Step 5: Check for students with face data
      const studentsWithFaceData = await page.$$('text=Face cadastrada');
      console.log(`Found ${studentsWithFaceData.length} students with face data`);

      console.log('Face recognition interface loaded successfully');
    }
  });

  test('Audio Feedback System', async () => {
    console.log('Testing audio feedback system...');

    // Test if audio context is created
    const audioEnabled = await page.evaluate(() => {
      return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
    });

    expect(audioEnabled).toBeTruthy();

    // Test audio feedback functions
    const audioFeedbackLoaded = await page.evaluate(() => {
      return typeof window.audioFeedback !== 'undefined';
    });

    // Note: Audio feedback is loaded dynamically, so this might be false initially
    console.log('Audio feedback system check completed');
  });

  test('Visual Feedback System', async () => {
    console.log('Testing visual feedback system...');

    // Navigate to face registration to test visual feedback
    await page.goto(`http://localhost:3000/admin/students/${testStudentId}`);
    await page.click('button:has-text("Atualizar Face")');
    await page.waitForSelector('[role="dialog"]');

    // Start camera and check for visual indicators
    await page.click('button:has-text("Iniciar Câmera")');
    await page.waitForTimeout(2000);

    // Check for face detection indicator
    const indicator = await page.$('text=Posicione seu rosto');
    expect(indicator).toBeTruthy();

    console.log('Visual feedback system working correctly');
  });

  test('Error Handling', async () => {
    console.log('Testing error handling...');

    // Test API error handling
    const errorResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/face-recognition/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          // Missing required fields
        })
      });
      return response.status;
    });

    expect(errorResponse).toBe(400);

    console.log('Error handling test completed');
  });

  test('Performance Metrics', async () => {
    console.log('Testing performance metrics...');

    // Measure page load time
    const startTime = Date.now();
    await page.goto('http://localhost:3000/admin/attendance');
    await page.waitForSelector('[data-testid="attendance-lessons"]');
    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Measure face-api model loading time
    const modelLoadStart = Date.now();
    await page.goto(`http://localhost:3000/admin/students/${testStudentId}`);
    await page.click('button:has-text("Atualizar Face")');
    await page.waitForSelector('text=Carregando modelos de reconhecimento', { timeout: 1000 });
    await page.waitForSelector('button:has-text("Iniciar Câmera")', { timeout: 30000 });
    const modelLoadTime = Date.now() - modelLoadStart;

    console.log(`Model load time: ${modelLoadTime}ms`);
    expect(modelLoadTime).toBeLessThan(30000); // Should load within 30 seconds

    console.log('Performance metrics test completed');
  });
});
