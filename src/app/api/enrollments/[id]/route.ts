import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/enrollments/[id] - Get a specific enrollment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            allowsMakeup: true
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            maxStudents: true
          }
        },
        transferredFrom: {
          select: {
            id: true,
            class: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        transferredTo: {
          select: {
            id: true,
            class: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    console.error('Get enrollment error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/enrollments/[id] - Update an enrollment
export async function PUT(
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
    const { status, type, notes, absenceCount } = body;

    // Get old values for audit
    const oldEnrollment = await prisma.enrollment.findUnique({
      where: { id }
    });

    if (!oldEnrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
      
      // Handle status changes
      if (status === 'inactive' && oldEnrollment.status !== 'inactive') {
        updateData.inactivatedAt = new Date();
      } else if (status === 'active' && oldEnrollment.status === 'inactive') {
        updateData.reactivatedAt = new Date();
      }
    }
    
    if (type !== undefined) updateData.type = type;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (absenceCount !== undefined) {
      updateData.absenceCount = absenceCount;
      
      // Auto-inactivate if absences >= 3
      if (absenceCount >= 3 && oldEnrollment.status === 'active') {
        updateData.status = 'inactive';
        updateData.inactivatedAt = new Date();
      }
    }

    const enrollment = await prisma.enrollment.update({
      where: { id },
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

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'enrollments',
        recordId: enrollment.id,
        oldValues: JSON.stringify(oldEnrollment),
        newValues: JSON.stringify(enrollment)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated enrollment for student ${enrollment.student.name}`,
        metadata: JSON.stringify({ 
          enrollmentId: enrollment.id,
          changes: updateData
        }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    console.error('Update enrollment error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/enrollments/[id] - Delete an enrollment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Get enrollment for audit
    const enrollment = await prisma.enrollment.findUnique({
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
        }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    // Check if there are attendance records
    const attendanceCount = await prisma.attendance.count({
      where: {
        studentId: enrollment.studentId,
        lesson: {
          class: {
            courseId: enrollment.courseId
          }
        }
      }
    });

    if (attendanceCount > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir matrícula com registros de presença' },
        { status: 400 }
      );
    }

    await prisma.enrollment.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'enrollments',
        recordId: id,
        oldValues: JSON.stringify(enrollment)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User deleted enrollment for student ${enrollment.student.name} from course ${enrollment.course.name}`,
        metadata: JSON.stringify({ enrollmentId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ message: 'Matrícula excluída com sucesso' });
  } catch (error) {
    console.error('Delete enrollment error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
