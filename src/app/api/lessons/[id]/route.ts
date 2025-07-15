import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/lessons/[id] - Get a specific lesson
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

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                allowsMakeup: true
              }
            },
            enrollments: {
              where: {
                status: 'active'
              },
              include: {
                student: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    faceDescriptor: true,
                    photoUrl: true,
                    faceDataUpdatedAt: true
                  }
                }
              }
            }
          }
        },
        attendance: {
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
        }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: lesson });
  } catch (error) {
    console.error('Get lesson error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/lessons/[id] - Update a lesson
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
    const { title, description, scheduledDate, duration, location, isCompleted, notes } = body;

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

    // Get old values for audit
    const oldLesson = await prisma.lesson.findUnique({
      where: { id }
    });

    if (!oldLesson) {
      return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 });
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        scheduledDate: new Date(scheduledDate),
        duration: duration ? parseInt(duration) : oldLesson.duration,
        location: location?.trim() || null,
        isCompleted: isCompleted !== undefined ? isCompleted : oldLesson.isCompleted,
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
        action: 'UPDATE',
        tableName: 'lessons',
        recordId: lesson.id,
        oldValues: JSON.stringify(oldLesson),
        newValues: JSON.stringify(lesson)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User updated lesson: ${lesson.title}`,
        metadata: JSON.stringify({ lessonId: lesson.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: lesson });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/lessons/[id] - Delete a lesson
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

    // Get lesson data before deletion for audit
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 });
    }

    // Delete the lesson (this will cascade delete attendance records)
    await prisma.lesson.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'lessons',
        recordId: id,
        oldValues: JSON.stringify(lesson)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'high',
        description: `User deleted lesson: ${lesson.title}`,
        metadata: JSON.stringify({ lessonId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ message: 'Aula excluída com sucesso' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
