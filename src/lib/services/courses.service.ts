import { apiClient, ApiResponse } from '../api-client';

export interface Course {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    classes: number;
  };
}

export interface CreateCourseRequest {
  name: string;
  description?: string;
  duration?: number;
  isActive?: boolean;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  id: string;
}

class CoursesService {
  async getCourses(search?: string): Promise<ApiResponse<Course[]>> {
    const url = search ? `/api/courses?search=${encodeURIComponent(search)}` : '/api/courses';
    return apiClient.get<Course[]>(url);
  }

  async getCourse(id: string): Promise<ApiResponse<Course>> {
    return apiClient.get<Course>(`/api/courses/${id}`);
  }

  async createCourse(course: CreateCourseRequest): Promise<ApiResponse<Course>> {
    return apiClient.post<Course>('/api/courses', course);
  }

  async updateCourse(id: string, course: Partial<CreateCourseRequest>): Promise<ApiResponse<Course>> {
    return apiClient.put<Course>(`/api/courses/${id}`, course);
  }

  async deleteCourse(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/courses/${id}`);
  }
}

export const coursesService = new CoursesService();