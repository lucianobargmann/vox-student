import { apiClient, ApiResponse } from '../api-client';

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  status: 'active' | 'inactive' | 'completed' | 'dropped';
  enrolledAt: string;
  completedAt?: string;
  student: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  class: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
    };
  };
}

export interface CreateEnrollmentRequest {
  studentId: string;
  courseId: string;
  classId?: string | null;
  type?: 'regular' | 'guest' | 'restart';
  notes?: string;
  transferredFromId?: string;
}

export interface TransferEnrollmentRequest {
  enrollmentId: string;
  newClassId: string;
  transferType?: 'restart' | 'guest';
  notes?: string;
}

export interface UpdateAbsencesRequest {
  enrollmentId: string;
  allowedAbsences: number;
}

class EnrollmentsService {
  async getEnrollments(classId?: string, studentId?: string): Promise<ApiResponse<Enrollment[]>> {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (studentId) params.append('studentId', studentId);
    
    const url = `/api/enrollments${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<Enrollment[]>(url);
  }

  async getEnrollment(id: string): Promise<ApiResponse<Enrollment>> {
    return apiClient.get<Enrollment>(`/api/enrollments/${id}`);
  }

  async createEnrollment(enrollment: CreateEnrollmentRequest): Promise<ApiResponse<Enrollment>> {
    return apiClient.post<Enrollment>('/api/enrollments', enrollment);
  }

  async updateEnrollment(id: string, enrollment: Partial<CreateEnrollmentRequest>): Promise<ApiResponse<Enrollment>> {
    return apiClient.put<Enrollment>(`/api/enrollments/${id}`, enrollment);
  }

  async deleteEnrollment(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/enrollments/${id}`);
  }

  async reactivateEnrollment(id: string, resetAbsences: boolean = false, notes?: string): Promise<ApiResponse<Enrollment>> {
    return apiClient.post<Enrollment>(`/api/enrollments/${id}/reactivate`, { resetAbsences, notes });
  }

  async transferEnrollment(transfer: TransferEnrollmentRequest): Promise<ApiResponse<Enrollment>> {
    return apiClient.post<Enrollment>('/api/enrollments/transfer', transfer);
  }

  async updateAbsences(update: UpdateAbsencesRequest): Promise<ApiResponse<Enrollment>> {
    return apiClient.put<Enrollment>('/api/enrollments/update-absences', update);
  }
}

export const enrollmentsService = new EnrollmentsService();