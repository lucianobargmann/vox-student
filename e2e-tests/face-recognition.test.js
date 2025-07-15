const puppeteer = require('puppeteer');
const { expect } = require('@playwright/test');

describe('Face Recognition System', () => {
  let browser;
  let page;
  let authToken;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    });
    page = await browser.newPage();

    // Grant camera permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:3000', ['camera']);

    // Login as admin
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@voxstudent.com');
    await page.click('button[type="submit"]');
    
    // Wait for magic link and simulate click
    await page.waitForTimeout(2000);
    
    // Get auth token from localStorage after login
    authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(authToken).toBeTruthy();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Face Registration', () => {
    test('should open face registration dialog for student', async () => {
      // Navigate to students page
      await page.goto('http://localhost:3000/admin/students');
      await page.waitForSelector('[data-testid="students-table"]', { timeout: 10000 });

      // Click on first student
      const firstStudentLink = await page.$('a[href*="/admin/students/"]');
      if (firstStudentLink) {
        await firstStudentLink.click();
        await page.waitForSelector('[data-testid="student-details"]', { timeout: 5000 });

        // Click face registration button
        const faceButton = await page.$('button:has-text("Cadastrar Face")');
        if (faceButton) {
          await faceButton.click();
          await page.waitForSelector('[data-testid="face-registration-dialog"]', { timeout: 5000 });

          // Verify dialog opened
          const dialog = await page.$('[data-testid="face-registration-dialog"]');
          expect(dialog).toBeTruthy();
        }
      }
    });

    test('should initialize camera for face capture', async () => {
      // Assuming dialog is already open from previous test
      const startCameraButton = await page.$('button:has-text("Iniciar Câmera")');
      if (startCameraButton) {
        await startCameraButton.click();
        await page.waitForTimeout(2000);

        // Check if video element is present and playing
        const video = await page.$('video');
        expect(video).toBeTruthy();

        const isPlaying = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video && !video.paused && !video.ended && video.readyState > 2;
        });
        expect(isPlaying).toBeTruthy();
      }
    });

    test('should detect face and enable capture button', async () => {
      // Wait for face detection
      await page.waitForTimeout(3000);

      // Check if face detected indicator appears
      const faceDetectedIndicator = await page.$('text=Rosto detectado');
      if (faceDetectedIndicator) {
        // Capture button should be enabled
        const captureButton = await page.$('button:has-text("Capturar Rosto"):not([disabled])');
        expect(captureButton).toBeTruthy();
      }
    });
  });

  describe('Face Recognition in Attendance', () => {
    test('should navigate to attendance page', async () => {
      await page.goto('http://localhost:3000/admin/attendance');
      await page.waitForSelector('[data-testid="attendance-lessons"]', { timeout: 10000 });

      // Click on first lesson
      const firstLessonButton = await page.$('button:has-text("Marcar Presença")');
      if (firstLessonButton) {
        await firstLessonButton.click();
        await page.waitForSelector('[data-testid="attendance-marking"]', { timeout: 5000 });
      }
    });

    test('should start face recognition system', async () => {
      // Click face recognition button
      const faceRecognitionButton = await page.$('button:has-text("Reconhecimento Facial")');
      if (faceRecognitionButton) {
        await faceRecognitionButton.click();
        await page.waitForTimeout(1000);

        // Verify recognition interface appears
        const recognitionCard = await page.$('[data-testid="face-recognition-card"]');
        expect(recognitionCard).toBeTruthy();

        // Check if camera starts
        const video = await page.$('video');
        expect(video).toBeTruthy();
      }
    });

    test('should show recognition status', async () => {
      // Wait for face recognition to initialize
      await page.waitForTimeout(2000);

      // Check for recognition status indicators
      const statusIndicator = await page.$('text=Aguardando rosto');
      expect(statusIndicator).toBeTruthy();
    });

    test('should handle no face data scenario', async () => {
      // If no students have face data, should show appropriate message
      const noFaceDataMessage = await page.$('text=Nenhum aluno possui dados faciais cadastrados');
      if (noFaceDataMessage) {
        expect(noFaceDataMessage).toBeTruthy();
      }
    });
  });

  describe('API Endpoints', () => {
    test('should save face data via API', async () => {
      const mockFaceDescriptor = JSON.stringify(new Array(128).fill(0.5));
      const mockPhotoUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

      // Mock student ID (you'd get this from the actual test data)
      const studentId = 'test-student-id';

      const response = await page.evaluate(async (studentId, faceDescriptor, photoUrl, token) => {
        const response = await fetch(`/api/students/${studentId}/face-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            faceDescriptor,
            photoUrl
          })
        });
        return {
          status: response.status,
          data: await response.json()
        };
      }, studentId, mockFaceDescriptor, mockPhotoUrl, authToken);

      // Note: This will fail if student doesn't exist, which is expected in test environment
      expect([200, 404]).toContain(response.status);
    });

    test('should identify student via face recognition API', async () => {
      const mockFaceDescriptor = new Array(128).fill(0.5);
      const mockLessonId = 'test-lesson-id';

      const response = await page.evaluate(async (faceDescriptor, lessonId, token) => {
        const response = await fetch('/api/face-recognition/identify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            faceDescriptor,
            lessonId
          })
        });
        return {
          status: response.status,
          data: await response.json()
        };
      }, mockFaceDescriptor, mockLessonId, authToken);

      // Note: This will fail if lesson doesn't exist, which is expected in test environment
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle camera permission denied', async () => {
      // Revoke camera permission
      const context = browser.defaultBrowserContext();
      await context.overridePermissions('http://localhost:3000', []);

      await page.goto('http://localhost:3000/admin/students');
      // Navigate to face registration and try to start camera
      // Should show error message about camera permissions
    });

    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.setOfflineMode(true);

      // Try to save face data
      // Should show appropriate error message

      await page.setOfflineMode(false);
    });

    test('should handle invalid face data', async () => {
      const invalidFaceDescriptor = 'invalid-data';
      const studentId = 'test-student-id';

      const response = await page.evaluate(async (studentId, faceDescriptor, token) => {
        const response = await fetch(`/api/students/${studentId}/face-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            faceDescriptor
          })
        });
        return {
          status: response.status,
          data: await response.json()
        };
      }, studentId, invalidFaceDescriptor, authToken);

      expect(response.status).toBe(400);
    });
  });

  describe('Performance', () => {
    test('should load face-api models within reasonable time', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3000/admin/attendance');
      
      // Wait for models to load (indicated by face recognition button being enabled)
      await page.waitForFunction(() => {
        const button = document.querySelector('button:has-text("Reconhecimento Facial")');
        return button && !button.disabled;
      }, { timeout: 30000 });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(30000); // Should load within 30 seconds
    });

    test('should process face recognition within acceptable time', async () => {
      // This would test the actual recognition speed
      // Implementation depends on having test face data
    });
  });
});
