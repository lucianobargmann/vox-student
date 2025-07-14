import { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  profile: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface MockCourse {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  price?: number;
  allowsMakeup: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: {
    classes: number;
    enrollments: number;
  };
}

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Mock authentication for a user with specified role
   */
  async mockAuth(role: 'user' | 'admin' | 'super_admin' = 'super_admin') {
    const mockUser: MockUser = {
      id: 'test-user-id',
      email: 'luciano@hcktplanet.com',
      profile: {
        id: 'test-profile-id',
        fullName: 'Test User',
        role: role
      }
    };

    await this.page.addInitScript((user) => {
      localStorage.setItem('auth_token', 'valid-test-token');
      (window as any).__mockUser = user;
    }, mockUser);

    await this.page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser)
      });
    });

    return mockUser;
  }

  /**
   * Mock unauthenticated state
   */
  async mockUnauthenticated() {
    await this.page.addInitScript(() => {
      localStorage.removeItem('auth_token');
    });

    await this.page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token não fornecido' })
      });
    });
  }

  /**
   * Mock courses API with provided data
   */
  async mockCoursesAPI(courses: MockCourse[] = []) {
    await this.page.route('/api/courses*', async (route) => {
      const url = new URL(route.request().url());
      const searchTerm = url.searchParams.get('search');
      
      let filteredCourses = courses;
      if (searchTerm) {
        filteredCourses = courses.filter(course => 
          course.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: filteredCourses })
        });
      }
    });
  }

  /**
   * Mock individual course API
   */
  async mockCourseAPI(courseId: string, course: MockCourse) {
    await this.page.route(`/api/courses/${courseId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: course })
        });
      }
    });
  }

  /**
   * Mock course creation API
   */
  async mockCourseCreation(callback?: (data: any) => MockCourse) {
    await this.page.route('/api/courses', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        const createdCourse = callback ? callback(requestBody) : {
          id: 'new-course-id',
          ...requestBody,
          createdAt: new Date().toISOString(),
          isActive: true
        };
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: createdCourse })
        });
      }
    });
  }

  /**
   * Mock course update API
   */
  async mockCourseUpdate(courseId: string, existingCourse: MockCourse, callback?: (data: any) => MockCourse) {
    await this.page.route(`/api/courses/${courseId}`, async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        const updatedCourse = callback ? callback(requestBody) : {
          ...existingCourse,
          ...requestBody
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: updatedCourse })
        });
      }
    });
  }

  /**
   * Mock course deletion API
   */
  async mockCourseDeletion(courseId: string, shouldSucceed: boolean = true) {
    await this.page.route(`/api/courses/${courseId}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        if (shouldSucceed) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Não é possível excluir curso com turmas ou matrículas ativas' })
          });
        }
      }
    });
  }

  /**
   * Create a sample course for testing
   */
  createSampleCourse(overrides: Partial<MockCourse> = {}): MockCourse {
    return {
      id: 'course-1',
      name: 'Academy',
      description: 'Curso básico de canto',
      duration: 40,
      price: 299.90,
      allowsMakeup: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      _count: {
        classes: 2,
        enrollments: 15
      },
      ...overrides
    };
  }

  /**
   * Fill course form with provided data
   */
  async fillCourseForm(courseData: {
    name: string;
    description?: string;
    duration?: string;
    price?: string;
    allowsMakeup?: boolean;
    isActive?: boolean;
  }) {
    await this.page.fill('input[id="name"]', courseData.name);
    
    if (courseData.description) {
      await this.page.fill('textarea[id="description"]', courseData.description);
    }
    
    if (courseData.duration) {
      await this.page.fill('input[id="duration"]', courseData.duration);
    }
    
    if (courseData.price) {
      await this.page.fill('input[id="price"]', courseData.price);
    }
    
    if (courseData.allowsMakeup !== undefined) {
      if (courseData.allowsMakeup) {
        await this.page.check('input[id="allowsMakeup"]');
      } else {
        await this.page.uncheck('input[id="allowsMakeup"]');
      }
    }
    
    if (courseData.isActive !== undefined) {
      if (courseData.isActive) {
        await this.page.check('input[id="isActive"]');
      } else {
        await this.page.uncheck('input[id="isActive"]');
      }
    }
  }

  /**
   * Wait for navigation and loading to complete
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Mock magic link API
   */
  async mockMagicLinkAPI(shouldSucceed: boolean = true) {
    await this.page.route('/api/auth/magic-link', async (route) => {
      if (shouldSucceed) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Link enviado com sucesso!' })
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email inválido' })
        });
      }
    });
  }

  /**
   * Mock token verification API
   */
  async mockTokenVerification(shouldSucceed: boolean = true) {
    await this.page.route('/api/auth/verify', async (route) => {
      if (shouldSucceed) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'jwt-token-here',
            user: {
              id: 'user-id',
              email: 'luciano@hcktplanet.com',
              profile: {
                id: 'profile-id',
                fullName: 'Luciano Bargmann',
                role: 'super_admin'
              }
            }
          })
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Link inválido ou expirado' })
        });
      }
    });
  }
}
