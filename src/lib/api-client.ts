/**
 * Centralized API client with automatic authentication
 */

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<{ data: T; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API Error [${config.method || 'GET'} ${url}]:`, error);
      throw error;
    }
  }

  // Generic CRUD methods
  async get<T>(endpoint: string): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Specific API methods
  
  // Classes
  async getClasses(params?: { courseId?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.courseId) searchParams.set('courseId', params.courseId);
    if (params?.search) searchParams.set('search', params.search);
    
    const query = searchParams.toString();
    return this.get(`/classes${query ? `?${query}` : ''}`);
  }

  async getClass(id: string) {
    return this.get(`/classes/${id}`);
  }

  async createClass(data: any) {
    return this.post('/classes', data);
  }

  async updateClass(id: string, data: any) {
    return this.put(`/classes/${id}`, data);
  }

  async deleteClass(id: string) {
    return this.delete(`/classes/${id}`);
  }

  // Students
  async getStudents(params?: { search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    
    const query = searchParams.toString();
    return this.get(`/students${query ? `?${query}` : ''}`);
  }

  async getStudent(id: string) {
    return this.get(`/students/${id}`);
  }

  async createStudent(data: any) {
    return this.post('/students', data);
  }

  async updateStudent(id: string, data: any) {
    return this.put(`/students/${id}`, data);
  }

  async deleteStudent(id: string) {
    return this.delete(`/students/${id}`);
  }

  // Courses
  async getCourses(params?: { search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    
    const query = searchParams.toString();
    return this.get(`/courses${query ? `?${query}` : ''}`);
  }

  async getCourse(id: string) {
    return this.get(`/courses/${id}`);
  }

  async createCourse(data: any) {
    return this.post('/courses', data);
  }

  async updateCourse(id: string, data: any) {
    return this.put(`/courses/${id}`, data);
  }

  async deleteCourse(id: string) {
    return this.delete(`/courses/${id}`);
  }

  // Enrollments
  async getEnrollments(params?: { 
    studentId?: string; 
    courseId?: string; 
    classId?: string; 
    status?: string; 
    type?: string; 
  }) {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.set('studentId', params.studentId);
    if (params?.courseId) searchParams.set('courseId', params.courseId);
    if (params?.classId) searchParams.set('classId', params.classId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.type) searchParams.set('type', params.type);
    
    const query = searchParams.toString();
    return this.get(`/enrollments${query ? `?${query}` : ''}`);
  }

  async getEnrollment(id: string) {
    return this.get(`/enrollments/${id}`);
  }

  async createEnrollment(data: any) {
    return this.post('/enrollments', data);
  }

  async updateEnrollment(id: string, data: any) {
    return this.put(`/enrollments/${id}`, data);
  }

  async deleteEnrollment(id: string) {
    return this.delete(`/enrollments/${id}`);
  }

  async reactivateEnrollment(id: string, data: { resetAbsences?: boolean; notes?: string }) {
    return this.post(`/enrollments/${id}/reactivate`, data);
  }

  async transferEnrollment(data: {
    enrollmentId: string;
    newClassId: string;
    transferType: 'restart' | 'guest';
    notes?: string;
  }) {
    return this.post('/enrollments/transfer', data);
  }

  async updateAbsences(data: {
    enrollmentIds?: string[];
    classId?: string;
    studentId?: string;
  }) {
    return this.post('/enrollments/update-absences', data);
  }

  // Auth
  async getMe() {
    return this.get('/auth/me');
  }

  async requestMagicLink(email: string) {
    return this.post('/auth/magic-link', { email });
  }

  async verifyMagicLink(token: string) {
    return this.post('/auth/verify', { token });
  }

  async logout() {
    return this.post('/auth/logout');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or custom instances
export { ApiClient };
