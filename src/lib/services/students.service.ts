import { apiClient, ApiResponse } from '../api-client';

export interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    enrollments: number;
  };
}

export interface CreateStudentRequest {
  name: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
  id: string;
}

export interface FaceData {
  descriptors: number[][];
  labels: string[];
}

class StudentsService {
  async getStudents(search?: string): Promise<ApiResponse<Student[]>> {
    const url = search ? `/api/students?search=${encodeURIComponent(search)}` : '/api/students';
    return apiClient.get<Student[]>(url);
  }

  async getStudent(id: string): Promise<ApiResponse<Student>> {
    return apiClient.get<Student>(`/api/students/${id}`);
  }

  async createStudent(student: CreateStudentRequest): Promise<ApiResponse<Student>> {
    return apiClient.post<Student>('/api/students', student);
  }

  async updateStudent(id: string, student: Partial<CreateStudentRequest>): Promise<ApiResponse<Student>> {
    return apiClient.put<Student>(`/api/students/${id}`, student);
  }

  async deleteStudent(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/students/${id}`);
  }

  async getFaceData(studentId: string): Promise<ApiResponse<FaceData>> {
    return apiClient.get<FaceData>(`/api/students/${studentId}/face-data`);
  }

  async updateFaceData(studentId: string, faceData: FaceData): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.put(`/api/students/${studentId}/face-data`, faceData);
  }
}

export const studentsService = new StudentsService();