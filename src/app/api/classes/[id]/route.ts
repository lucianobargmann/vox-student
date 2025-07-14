import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/classes/[id] - Get a specific class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            allowsMakeup: true
          }
        },
        lessons: {
          include: {
            _count: {
              select: {
                attendance: true
              }
            }
          },
          orderBy: { scheduledDate: 'asc' }
        },
        enrollments: {
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
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true
          }
        }
      }
    });

    if (!classData) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: classData });
  } catch (error) {
    console.error('Get class error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/classes/[id] - Update a class
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, startDate, endDate, schedule, maxStudents, isActive } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome da turma é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: 'Data de início é obrigatória' },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldClass = await prisma.class.findUnique({
      where: { id }
    });

    if (!oldClass) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    const classData = await prisma.class.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        schedule: schedule ? JSON.stringify(schedule) : null,
        maxStudents: maxStudents ? parseInt(maxStudents) : null,
        isActive: isActive !== undefined ? isActive : oldClass.isActive
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            allowsMakeup: true
          }
        }
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'classes',
        recordId: classData.id,
        oldValues: JSON.stringify(oldClass),
        newValues: JSON.stringify(classData)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated class: ${classData.name}`,
        metadata: JSON.stringify({ classId: classData.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: classData });
  } catch (error) {
    console.error('Update class error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/classes/[id] - Delete a class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get class for audit
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        enrollments: true,
        lessons: true
      }
    });

    if (!classData) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    // Check if class has enrollments or lessons
    if (classData.enrollments.length || classData.lessons.length) {
      return NextResponse.json(
        { error: 'Não é possível excluir turma com matrículas ou aulas' },
        { status: 400 }
      );
    }

    await prisma.class.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'classes',
        recordId: id,
        oldValues: JSON.stringify(classData)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User deleted class: ${classData.name}`,
        metadata: JSON.stringify({ classId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete class error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
