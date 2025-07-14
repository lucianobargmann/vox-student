import { prisma } from '@/lib/prisma';
import { EnrollmentStatus, EnrollmentType, PresenceStatus } from '@prisma/client';

export interface EnrollmentWithDetails {
  id: string;
  studentId: string;
  courseId: string;
  classId: string | null;
  status: EnrollmentStatus;
  type: EnrollmentType;
  absenceCount: number;
  inactivatedAt: Date | null;
  reactivatedAt: Date | null;
  student: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  course: {
    id: string;
    name: string;
  };
  class: {
    id: string;
    name: string;
  } | null;
}

/**
 * Calculate absence count for a student enrollment based on attendance records
 */
export async function calculateAbsenceCount(enrollmentId: string): Promise<number> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      class: {
        include: {
          lessons: {
            include: {
              attendance: {
                where: {
                  studentId: {
                    equals: prisma.enrollment.findUnique({
                      where: { id: enrollmentId }
                    }).then(e => e?.studentId)
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!enrollment || !enrollment.class) {
    return 0;
  }

  // Count absences from attendance records
  let absenceCount = 0;
  
  for (const lesson of enrollment.class.lessons) {
    const attendance = lesson.attendance.find(a => a.studentId === enrollment.studentId);
    if (attendance && attendance.status === PresenceStatus.absent) {
      absenceCount++;
    } else if (!attendance && lesson.scheduledDate < new Date()) {
      // If no attendance record exists for a past lesson, count as absent
      absenceCount++;
    }
  }

  return absenceCount;
}

/**
 * Update enrollment absence count and status based on attendance
 */
export async function updateEnrollmentAbsenceCount(enrollmentId: string): Promise<EnrollmentWithDetails | null> {
  const absenceCount = await calculateAbsenceCount(enrollmentId);
  
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId }
  });

  if (!enrollment) {
    return null;
  }

  // Determine if student should be inactivated
  const shouldInactivate = absenceCount >= 3 && enrollment.status === EnrollmentStatus.active;
  
  const updateData: any = {
    absenceCount
  };

  if (shouldInactivate) {
    updateData.status = EnrollmentStatus.inactive;
    updateData.inactivatedAt = new Date();
  }

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: updateData,
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      course: {
        select: {
          id: true,
          name: true
        }
      },
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return updatedEnrollment as EnrollmentWithDetails;
}

/**
 * Reactivate an inactive student enrollment
 */
export async function reactivateEnrollment(
  enrollmentId: string, 
  resetAbsences: boolean = false
): Promise<EnrollmentWithDetails | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId }
  });

  if (!enrollment) {
    return null;
  }

  if (enrollment.status !== EnrollmentStatus.inactive) {
    throw new Error('Apenas matrículas inativas podem ser reativadas');
  }

  const updateData: any = {
    status: EnrollmentStatus.active,
    reactivatedAt: new Date()
  };

  if (resetAbsences) {
    updateData.absenceCount = 0;
  }

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: updateData,
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      course: {
        select: {
          id: true,
          name: true
        }
      },
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return updatedEnrollment as EnrollmentWithDetails;
}

/**
 * Get enrollment statistics for a student
 */
export async function getEnrollmentStats(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: {
        select: {
          id: true,
          name: true
        }
      },
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status === EnrollmentStatus.active).length,
    inactive: enrollments.filter(e => e.status === EnrollmentStatus.inactive).length,
    completed: enrollments.filter(e => e.status === EnrollmentStatus.completed).length,
    transferred: enrollments.filter(e => e.status === EnrollmentStatus.transferred).length,
    totalAbsences: enrollments.reduce((sum, e) => sum + e.absenceCount, 0),
    averageAbsences: enrollments.length > 0 
      ? enrollments.reduce((sum, e) => sum + e.absenceCount, 0) / enrollments.length 
      : 0,
    enrollmentsByType: {
      regular: enrollments.filter(e => e.type === EnrollmentType.regular).length,
      guest: enrollments.filter(e => e.type === EnrollmentType.guest).length,
      restart: enrollments.filter(e => e.type === EnrollmentType.restart).length
    }
  };

  return stats;
}

/**
 * Check if a student can be enrolled in a class
 */
export async function canEnrollInClass(studentId: string, classId: string): Promise<{
  canEnroll: boolean;
  reason?: string;
}> {
  // Check if class exists and get details
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      enrollments: true,
      course: true
    }
  });

  if (!classData) {
    return { canEnroll: false, reason: 'Turma não encontrada' };
  }

  // Check if class is active
  if (!classData.isActive) {
    return { canEnroll: false, reason: 'Turma não está ativa' };
  }

  // Check capacity
  if (classData.maxStudents && classData.enrollments.length >= classData.maxStudents) {
    return { canEnroll: false, reason: 'Turma já atingiu o número máximo de alunos' };
  }

  // Check if student is already enrolled
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      classId,
      status: { in: [EnrollmentStatus.active, EnrollmentStatus.inactive] }
    }
  });

  if (existingEnrollment) {
    return { canEnroll: false, reason: 'Aluno já está matriculado nesta turma' };
  }

  // Check if student exists
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });

  if (!student) {
    return { canEnroll: false, reason: 'Aluno não encontrado' };
  }

  return { canEnroll: true };
}

/**
 * Get students eligible for makeup classes in a course
 */
export async function getEligibleMakeupStudents(courseId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      status: EnrollmentStatus.active,
      absenceCount: { gt: 0 }
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      class: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      absenceCount: 'desc'
    }
  });

  return enrollments;
}
