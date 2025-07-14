import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { updateEnrollmentAbsenceCount } from '@/lib/enrollment-utils';

// POST /api/enrollments/update-absences - Update absence counts for enrollments
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { enrollmentIds, classId, studentId } = body;

    let enrollmentsToUpdate: string[] = [];

    if (enrollmentIds && Array.isArray(enrollmentIds)) {
      enrollmentsToUpdate = enrollmentIds;
    } else if (classId) {
      // Update all enrollments in a class
      const enrollments = await prisma.enrollment.findMany({
        where: { classId },
        select: { id: true }
      });
      enrollmentsToUpdate = enrollments.map(e => e.id);
    } else if (studentId) {
      // Update all enrollments for a student
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId },
        select: { id: true }
      });
      enrollmentsToUpdate = enrollments.map(e => e.id);
    } else {
      return NextResponse.json(
        { error: 'É necessário fornecer enrollmentIds, classId ou studentId' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // Update each enrollment
    for (const enrollmentId of enrollmentsToUpdate) {
      try {
        const updatedEnrollment = await updateEnrollmentAbsenceCount(enrollmentId);
        if (updatedEnrollment) {
          results.push(updatedEnrollment);
        }
      } catch (error) {
        console.error(`Error updating enrollment ${enrollmentId}:`, error);
        errors.push({
          enrollmentId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated absence counts for ${results.length} enrollments`,
        metadata: JSON.stringify({ 
          updatedCount: results.length,
          errorCount: errors.length,
          classId,
          studentId
        }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ 
      data: {
        updated: results,
        errors: errors,
        summary: {
          totalProcessed: enrollmentsToUpdate.length,
          successful: results.length,
          failed: errors.length,
          inactivated: results.filter(r => r.status === 'inactive').length
        }
      }
    });
  } catch (error) {
    console.error('Update absences error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// GET /api/enrollments/update-absences - Get enrollments that need absence count updates
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const courseId = searchParams.get('courseId');

    let whereClause: any = {
      status: { in: ['active', 'inactive'] }
    };

    if (classId) {
      whereClause.classId = classId;
    } else if (courseId) {
      whereClause.courseId = courseId;
    }

    // Get enrollments with their current absence counts and attendance data
    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true
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
            name: true,
            lessons: {
              where: {
                scheduledDate: { lt: new Date() } // Only past lessons
              },
              include: {
                attendance: true
              }
            }
          }
        }
      }
    });

    // Calculate actual absence counts and compare with stored values
    const enrollmentsNeedingUpdate = [];

    for (const enrollment of enrollments) {
      if (!enrollment.class) continue;

      let actualAbsences = 0;
      
      for (const lesson of enrollment.class.lessons) {
        const attendance = lesson.attendance.find(a => a.studentId === enrollment.studentId);
        if (!attendance || attendance.status === 'absent') {
          actualAbsences++;
        }
      }

      if (actualAbsences !== enrollment.absenceCount) {
        enrollmentsNeedingUpdate.push({
          ...enrollment,
          actualAbsences,
          storedAbsences: enrollment.absenceCount,
          needsUpdate: true,
          shouldBeInactive: actualAbsences >= 3 && enrollment.status === 'active'
        });
      }
    }

    return NextResponse.json({ 
      data: enrollmentsNeedingUpdate,
      summary: {
        totalEnrollments: enrollments.length,
        needingUpdate: enrollmentsNeedingUpdate.length,
        shouldBeInactivated: enrollmentsNeedingUpdate.filter(e => e.shouldBeInactive).length
      }
    });
  } catch (error) {
    console.error('Get enrollments needing update error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
