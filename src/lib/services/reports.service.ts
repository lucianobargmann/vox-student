import { apiClient, ApiResponse } from '../api-client';

export interface ReportStats {
  totalStudents: number;
  totalCourses: number;
  totalClasses: number;
  activeEnrollments: number;
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

export interface AttendanceReport {
  studentId: string;
  studentName: string;
  totalLessons: number;
  attendedLessons: number;
  attendanceRate: number;
  lastAttendance?: string;
}

export interface CourseReport {
  courseId: string;
  courseName: string;
  totalClasses: number;
  totalStudents: number;
  averageAttendance: number;
}

class ReportsService {
  async getStats(): Promise<ApiResponse<ReportStats>> {
    const [studentsResponse, coursesResponse, classesResponse] = await Promise.all([
      apiClient.get('/api/students'),
      apiClient.get('/api/courses'),
      apiClient.get('/api/classes')
    ]);

    if (!studentsResponse.success || !coursesResponse.success || !classesResponse.success) {
      return {
        success: false,
        error: 'Erro ao carregar estatísticas'
      };
    }

    const students = studentsResponse.data || [];
    const courses = coursesResponse.data || [];
    const classes = classesResponse.data || [];

    const stats: ReportStats = {
      totalStudents: students.length,
      totalCourses: courses.length,
      totalClasses: classes.length,
      activeEnrollments: students.reduce((acc: number, student: any) => 
        acc + (student._count?.enrollments || 0), 0)
    };

    return {
      success: true,
      data: stats
    };
  }

  async generateStudentsReport(filters?: ReportFilter): Promise<ApiResponse<Student[]>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.courseId) params.append('courseId', filters.courseId);

    const url = `/api/reports/students${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<Student[]>(url);
  }

  async generateAttendanceReport(filters?: ReportFilter): Promise<ApiResponse<AttendanceReport[]>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.classId) params.append('classId', filters.classId);

    const url = `/api/reports/attendance${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<AttendanceReport[]>(url);
  }

  async generateCoursesReport(filters?: ReportFilter): Promise<ApiResponse<CourseReport[]>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const url = `/api/reports/courses${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<CourseReport[]>(url);
  }

  async exportReport(
    reportType: 'students' | 'attendance' | 'courses',
    format: 'csv' | 'pdf' | 'xlsx',
    filters?: ReportFilter
  ): Promise<ApiResponse<Blob>> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.courseId) params.append('courseId', filters.courseId);
    if (filters?.classId) params.append('classId', filters.classId);

    const url = `/api/reports/${reportType}/export?${params.toString()}`;
    
    // For file downloads, we need to handle the response differently
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Erro ao gerar relatório'
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro ao baixar relatório'
      };
    }
  }
}

export const reportsService = new ReportsService();