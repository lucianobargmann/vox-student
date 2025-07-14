import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/enrollments - Get all enrollments with filters
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let whereClause: any = {};

    if (studentId) whereClause.studentId = studentId;
    if (courseId) whereClause.courseId = courseId;
    if (classId) whereClause.classId = classId;
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
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
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed enrollments list`,
        metadata: JSON.stringify({ studentId, courseId, classId, status, type }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: enrollments });
  } catch (error) {
    console.error('Get enrollments error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/enrollments - Create a new enrollment
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      studentId, 
      courseId, 
      classId, 
      type = 'regular', 
      notes,
      transferredFromId 
    } = body;

    // Validations
    if (!studentId) {
      return NextResponse.json(
        { error: 'ID do aluno é obrigatório' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'ID do curso é obrigatório' },
        { status: 400 }
      );
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      );
    }

    // Verify class exists if provided
    if (classId) {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          enrollments: true
        }
      });

      if (!classData) {
        return NextResponse.json(
          { error: 'Turma não encontrada' },
          { status: 404 }
        );
      }

      // Check if class belongs to the course
      if (classData.courseId !== courseId) {
        return NextResponse.json(
          { error: 'Turma não pertence ao curso selecionado' },
          { status: 400 }
        );
      }

      // Check class capacity
      if (classData.maxStudents && classData.enrollments.length >= classData.maxStudents) {
        return NextResponse.json(
          { error: 'Turma já atingiu o número máximo de alunos' },
          { status: 400 }
        );
      }
    }

    // Check for existing enrollment
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
        classId: classId || null
      }
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Aluno já está matriculado neste curso/turma' },
        { status: 400 }
      );
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        classId: classId || null,
        type,
        notes: notes?.trim() || null,
        transferredFromId: transferredFromId || null
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
        }
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'enrollments',
        recordId: enrollment.id,
        newValues: JSON.stringify(enrollment)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User enrolled student ${student.name} in course ${course.name}`,
        metadata: JSON.stringify({ 
          enrollmentId: enrollment.id, 
          studentId, 
          courseId, 
          classId, 
          type 
        }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: enrollment }, { status: 201 });
  } catch (error) {
    console.error('Create enrollment error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
