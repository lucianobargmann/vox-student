import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST /api/enrollments/transfer - Transfer student between classes
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      enrollmentId, 
      newClassId, 
      transferType = 'restart', // 'restart' or 'guest'
      notes 
    } = body;

    // Validations
    if (!enrollmentId) {
      return NextResponse.json(
        { error: 'ID da matrícula é obrigatório' },
        { status: 400 }
      );
    }

    if (!newClassId) {
      return NextResponse.json(
        { error: 'ID da nova turma é obrigatório' },
        { status: 400 }
      );
    }

    // Get original enrollment
    const originalEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        course: true,
        class: true
      }
    });

    if (!originalEnrollment) {
      return NextResponse.json(
        { error: 'Matrícula não encontrada' },
        { status: 404 }
      );
    }

    // Get new class
    const newClass = await prisma.class.findUnique({
      where: { id: newClassId },
      include: {
        enrollments: true,
        course: true
      }
    });

    if (!newClass) {
      return NextResponse.json(
        { error: 'Nova turma não encontrada' },
        { status: 404 }
      );
    }

    // Verify new class belongs to the same course
    if (newClass.courseId !== originalEnrollment.courseId) {
      return NextResponse.json(
        { error: 'A nova turma deve pertencer ao mesmo curso' },
        { status: 400 }
      );
    }

    // Check if student is already enrolled in the new class
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: originalEnrollment.studentId,
        classId: newClassId,
        status: { in: ['active', 'inactive'] }
      }
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Aluno já está matriculado na turma de destino' },
        { status: 400 }
      );
    }

    // Check class capacity
    if (newClass.maxStudents && newClass.enrollments.length >= newClass.maxStudents) {
      return NextResponse.json(
        { error: 'Nova turma já atingiu o número máximo de alunos' },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update original enrollment status
      const updatedOriginalEnrollment = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: 'transferred'
        }
      });

      // Create new enrollment
      const newEnrollment = await tx.enrollment.create({
        data: {
          studentId: originalEnrollment.studentId,
          courseId: originalEnrollment.courseId,
          classId: newClassId,
          type: transferType,
          status: 'active',
          transferredFromId: enrollmentId,
          notes: notes?.trim() || null,
          absenceCount: transferType === 'restart' ? 0 : originalEnrollment.absenceCount
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
          }
        }
      });

      return { updatedOriginalEnrollment, newEnrollment };
    });

    // Log audit events
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'enrollments',
        recordId: enrollmentId,
        oldValues: JSON.stringify(originalEnrollment),
        newValues: JSON.stringify(result.updatedOriginalEnrollment)
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'enrollments',
        recordId: result.newEnrollment.id,
        newValues: JSON.stringify(result.newEnrollment)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User transferred student ${originalEnrollment.student.name} from class ${originalEnrollment.class?.name} to class ${newClass.name}`,
        metadata: JSON.stringify({ 
          originalEnrollmentId: enrollmentId,
          newEnrollmentId: result.newEnrollment.id,
          transferType,
          studentId: originalEnrollment.studentId,
          courseId: originalEnrollment.courseId,
          oldClassId: originalEnrollment.classId,
          newClassId
        }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ 
      data: {
        originalEnrollment: result.updatedOriginalEnrollment,
        newEnrollment: result.newEnrollment
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Transfer enrollment error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
