import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST /api/face-recognition/mark-attendance - Mark attendance via face recognition
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { studentId, lessonId, confidence } = await request.json();

    if (!studentId || !lessonId) {
      return NextResponse.json(
        { error: 'Student ID e Lesson ID são obrigatórios' },
        { status: 400 }
      );
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        class: {
          include: {
            course: true
          }
        }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 });
    }

    // Verify student exists and is enrolled in this class
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: {
            classId: lesson.classId,
            status: 'active'
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    if (student.enrollments.length === 0) {
      return NextResponse.json(
        { error: 'Aluno não está matriculado nesta turma' },
        { status: 400 }
      );
    }

    // Check if attendance already exists
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        studentId,
        lessonId
      }
    });

    let attendance;

    if (existingAttendance) {
      // Update existing attendance
      attendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: 'present',
          markedAt: new Date(),
          markedByFacialRecognition: true,
          notes: `Reconhecimento facial (${confidence}% confiança)`
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
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          studentId,
          lessonId,
          status: 'present',
          markedAt: new Date(),
          markedByFacialRecognition: true,
          notes: `Reconhecimento facial (${confidence}% confiança)`
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
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: existingAttendance ? 'UPDATE' : 'CREATE',
        tableName: 'attendance',
        recordId: attendance.id,
        newValues: JSON.stringify({
          studentId,
          lessonId,
          status: 'present',
          markedByFacialRecognition: true,
          confidence
        })
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'facial_recognition_attendance',
        severity: 'low',
        description: `Attendance marked via facial recognition for ${student.name}`,
        metadata: JSON.stringify({
          studentId,
          studentName: student.name,
          lessonId,
          lessonTitle: lesson.title,
          confidence,
          action: existingAttendance ? 'updated' : 'created'
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({
      data: attendance,
      message: `Presença de ${student.name} marcada automaticamente via reconhecimento facial`
    });
  } catch (error) {
    console.error('Mark attendance via face recognition error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
