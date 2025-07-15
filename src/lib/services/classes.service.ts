import { apiClient, ApiResponse } from '../api-client';

export interface Class {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  maxStudents?: number;
  course: {
    id: string;
    name: string;
  };
  _count: {
    enrollments: number;
    lessons: number;
  };
}

export interface CreateClassRequest {
  name: string;
  description?: string;
  courseId: string;
  startDate: string;
  endDate?: string;
  maxStudents?: number;
  isActive?: boolean;
}

export interface UpdateClassRequest extends Partial<CreateClassRequest> {
  id: string;
}

export interface GenerateLessonsRequest {
  startDate: string;
  endDate: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // HH:mm format
  duration: number; // minutes
}

class ClassesService {
  async getClasses(search?: string): Promise<ApiResponse<Class[]>> {
    const url = search ? `/api/classes?search=${encodeURIComponent(search)}` : '/api/classes';
    return apiClient.get<Class[]>(url);
  }

  async getClass(id: string): Promise<ApiResponse<Class>> {
    return apiClient.get<Class>(`/api/classes/${id}`);
  }

  async createClass(classData: CreateClassRequest): Promise<ApiResponse<Class>> {
    return apiClient.post<Class>('/api/classes', classData);
  }

  async updateClass(id: string, classData: Partial<CreateClassRequest>): Promise<ApiResponse<Class>> {
    return apiClient.put<Class>(`/api/classes/${id}`, classData);
  }

  async deleteClass(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/classes/${id}`);
  }

  async generateLessons(classId: string, lessonsData: GenerateLessonsRequest): Promise<ApiResponse<{ success: boolean; message: string; lessonsGenerated: number }>> {
    return apiClient.post(`/api/classes/${classId}/generate-lessons`, lessonsData);
  }
}

export const classesService = new ClassesService();