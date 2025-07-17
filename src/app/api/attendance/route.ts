import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/attendance - Get attendance records with optional filters
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');

    let whereClause: any = {};

    if (lessonId) {
      whereClause.lessonId = lessonId;
    }
    if (studentId) {
      whereClause.studentId = studentId;
    }
    if (classId) {
      whereClause.lesson = {
        classId: classId
      };
    }

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            class: {
              select: {
                id: true,
                name: true,
                course: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { lesson: { scheduledDate: 'desc' } },
        { student: { name: 'asc' } }
      ]
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed attendance records`,
        metadata: JSON.stringify({ lessonId, studentId, classId }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/attendance - Create or update attendance records for a lesson
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId, attendance } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'ID da aula é obrigatório' },
        { status: 400 }
      );
    }

    if (!attendance || !Array.isArray(attendance)) {
      return NextResponse.json(
        { error: 'Lista de presença é obrigatória' },
        { status: 400 }
      );
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        class: {
          include: {
            enrollments: {
              where: {
                status: 'active'
              },
              include: {
                student: true
              }
            }
          }
        }
      }
    });

    if (!lesson) {
      return NextResponse.json(
        { error: 'Aula não encontrada' },
        { status: 404 }
      );
    }

    // Validate that all students exist (removed enrollment restriction)
    const attendanceStudentIds = attendance.map((a: any) => a.studentId);

    const existingStudents = await prisma.student.findMany({
      where: { id: { in: attendanceStudentIds } },
      select: { id: true }
    });

    const existingStudentIds = existingStudents.map(s => s.id);
    const invalidStudents = attendanceStudentIds.filter(id => !existingStudentIds.includes(id));

    if (invalidStudents.length > 0) {
      return NextResponse.json(
        { error: 'Alguns alunos não foram encontrados no sistema' },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing attendance records for this lesson
      await tx.attendance.deleteMany({
        where: { lessonId }
      });

      // Create new attendance records
      const attendanceRecords = await Promise.all(
        attendance.map(async (record: any) => {
          const { studentId, status } = record;

          if (!['present', 'absent'].includes(status)) {
            throw new Error(`Status inválido: ${status}`);
          }

          return await tx.attendance.create({
            data: {
              studentId,
              lessonId,
              status,
              markedAt: new Date()
            },
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          });
        })
      );

      return attendanceRecords;
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'attendance',
        recordId: lessonId,
        newValues: JSON.stringify({ lessonId, attendanceCount: result.length })
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User marked attendance for lesson: ${lesson.title}`,
        metadata: JSON.stringify({ 
          lessonId, 
          attendanceCount: result.length,
          presentCount: result.filter(r => r.status === 'present').length
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ 
      data: result,
      message: 'Presença marcada com sucesso'
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/attendance - Update attendance records
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { attendanceId, status, notes } = body;

    if (!attendanceId) {
      return NextResponse.json(
        { error: 'ID da presença é obrigatório' },
        { status: 400 }
      );
    }

    if (!status || !['present', 'absent'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId }
    });

    if (!oldAttendance) {
      return NextResponse.json({ error: 'Registro de presença não encontrado' }, { status: 404 });
    }

    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status,
        notes: notes?.trim() || null,
        markedAt: new Date()
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
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledDate: true
          }
        }
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'attendance',
        recordId: attendanceId,
        oldValues: JSON.stringify(oldAttendance),
        newValues: JSON.stringify(attendance)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User updated attendance for student: ${attendance.student.name}`,
        metadata: JSON.stringify({ 
          attendanceId, 
          studentId: attendance.student.id,
          oldStatus: oldAttendance.status,
          newStatus: status
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ 
      data: attendance,
      message: 'Presença atualizada com sucesso'
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
