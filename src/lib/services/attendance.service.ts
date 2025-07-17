import { apiClient, ApiResponse } from '../api-client';

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  isActive: boolean;
  classId: string;
  class: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
    };
  };
  _count: {
    attendances: number;
  };
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  lessonId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  markedAt: string;
  markedBy?: string;
  notes?: string;
  student: Student;
}

export interface AttendanceStats {
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  lateStudents: number;
  excusedStudents: number;
  attendanceRate: number;
}

export interface MarkAttendanceRequest {
  studentId: string;
  status: 'present' | 'absent';
  notes?: string;
}

export interface FaceRecognitionResult {
  studentId?: string;
  confidence?: number;
  name?: string;
  success: boolean;
  message: string;
}

class AttendanceService {
  async getLessons(): Promise<ApiResponse<Lesson[]>> {
    return apiClient.get<Lesson[]>('/api/lessons');
  }

  async getLesson(id: string): Promise<ApiResponse<Lesson>> {
    return apiClient.get<Lesson>(`/api/lessons/${id}`);
  }

  async getLessonAttendances(lessonId: string): Promise<ApiResponse<Attendance[]>> {
    return apiClient.get<Attendance[]>(`/api/attendance?lessonId=${lessonId}`);
  }

  async markAttendance(lessonId: string, attendance: MarkAttendanceRequest): Promise<ApiResponse<Attendance>> {
    return apiClient.post<Attendance>('/api/attendance', {
      lessonId,
      ...attendance
    });
  }

  async updateAttendance(attendanceId: string, attendance: Partial<MarkAttendanceRequest>): Promise<ApiResponse<Attendance>> {
    return apiClient.put<Attendance>(`/api/attendance/${attendanceId}`, attendance);
  }

  async deleteAttendance(attendanceId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/attendance/${attendanceId}`);
  }

  async getAttendanceStats(lessonId: string): Promise<ApiResponse<AttendanceStats>> {
    return apiClient.get<AttendanceStats>(`/api/attendance/stats?lessonId=${lessonId}`);
  }

  async identifyStudent(imageData: string): Promise<ApiResponse<FaceRecognitionResult>> {
    return apiClient.post<FaceRecognitionResult>('/api/face-recognition/identify', {
      imageData
    });
  }

  async markAttendanceByFace(lessonId: string, imageData: string): Promise<ApiResponse<{ attendance: Attendance; recognition: FaceRecognitionResult }>> {
    return apiClient.post<{ attendance: Attendance; recognition: FaceRecognitionResult }>('/api/face-recognition/mark-attendance', {
      lessonId,
      imageData
    });
  }
}

export const attendanceService = new AttendanceService();