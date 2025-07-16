import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { getLessonsWithAttendance, getTodaysLessons, getActiveLessons } from '@/lib/lesson-utils';

// GET /api/lessons - Get lessons with optional filters
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const today = searchParams.get('today');
    const active = searchParams.get('active');

    let lessons;

    if (active === 'true') {
      // Get active lessons (1h before start to 1h after end)
      lessons = await getActiveLessons();
    } else if (today === 'true') {
      // Get today's lessons across all classes
      lessons = await getTodaysLessons();
    } else if (classId) {
      // Get lessons for a specific class with attendance data
      lessons = await getLessonsWithAttendance(classId);
    } else {
      // Get all lessons
      lessons = await prisma.lesson.findMany({
        include: {
          class: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              attendance: {
                where: {
                  status: 'present'
                }
              }
            }
          }
        },
        orderBy: { scheduledDate: 'asc' }
      });
    }

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed lessons list`,
        metadata: JSON.stringify({ classId, today, active }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: lessons });
  } catch (error) {
    console.error('Get lessons error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/lessons - Create a new lesson
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { classId, title, description, scheduledDate, duration, location, notes } = body;

    if (!classId) {
      return NextResponse.json(
        { error: 'ID da turma é obrigatório' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length < 2) {
      return NextResponse.json(
        { error: 'Título da aula é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    if (!scheduledDate) {
      return NextResponse.json(
        { error: 'Data da aula é obrigatória' },
        { status: 400 }
      );
    }

    // Verify class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return NextResponse.json(
        { error: 'Turma não encontrada' },
        { status: 404 }
      );
    }

    const lesson = await prisma.lesson.create({
      data: {
        classId,
        title: title.trim(),
        description: description?.trim() || null,
        scheduledDate: new Date(scheduledDate),
        duration: duration ? parseInt(duration) : 120,
        location: location?.trim() || null,
        notes: notes?.trim() || null
      },
      include: {
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
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'lessons',
        recordId: lesson.id,
        newValues: JSON.stringify(lesson)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User created lesson: ${lesson.title}`,
        metadata: JSON.stringify({ lessonId: lesson.id, classId }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: lesson });
  } catch (error) {
    console.error('Create lesson error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
