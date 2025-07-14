import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { reactivateEnrollment } from '@/lib/enrollment-utils';

// POST /api/enrollments/[id]/reactivate - Reactivate an inactive enrollment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { resetAbsences = false, notes } = body;

    // Get original enrollment for audit
    const originalEnrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true
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

    if (!originalEnrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    if (originalEnrollment.status !== 'inactive') {
      return NextResponse.json(
        { error: 'Apenas matrículas inativas podem ser reativadas' },
        { status: 400 }
      );
    }

    // Reactivate enrollment
    const reactivatedEnrollment = await reactivateEnrollment(id, resetAbsences);

    if (!reactivatedEnrollment) {
      return NextResponse.json(
        { error: 'Erro ao reativar matrícula' },
        { status: 500 }
      );
    }

    // Update notes if provided
    if (notes) {
      await prisma.enrollment.update({
        where: { id },
        data: { notes: notes.trim() }
      });
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'enrollments',
        recordId: id,
        oldValues: JSON.stringify(originalEnrollment),
        newValues: JSON.stringify(reactivatedEnrollment)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User reactivated enrollment for student ${originalEnrollment.student.name} in course ${originalEnrollment.course.name}`,
        metadata: JSON.stringify({ 
          enrollmentId: id,
          resetAbsences,
          studentId: originalEnrollment.studentId,
          courseId: originalEnrollment.courseId,
          classId: originalEnrollment.classId
        }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ 
      data: reactivatedEnrollment,
      message: `Matrícula reativada com sucesso${resetAbsences ? ' (faltas zeradas)' : ''}`
    });
  } catch (error) {
    console.error('Reactivate enrollment error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
