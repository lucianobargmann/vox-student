import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/courses/[id] - Get a specific course
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

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        classes: {
          include: {
            _count: {
              select: {
                enrollments: true,
                lessons: true
              }
            }
          }
        },
        _count: {
          select: {
            enrollments: true
          }
        }
      }
    });

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: course });
  } catch (error) {
    console.error('Get course error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/courses/[id] - Update a course
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
    const { name, description, duration, price, allowsMakeup, isActive } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome do curso é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldCourse = await prisma.course.findUnique({
      where: { id }
    });

    if (!oldCourse) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        duration: duration ? parseInt(duration) : null,
        price: price ? parseFloat(price) : null,
        allowsMakeup: allowsMakeup || false,
        isActive: isActive !== undefined ? isActive : oldCourse.isActive
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'courses',
        recordId: course.id,
        oldValues: JSON.stringify(oldCourse),
        newValues: JSON.stringify(course)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated course: ${course.name}`,
        metadata: JSON.stringify({ courseId: course.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: course });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/courses/[id] - Delete a course
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

    // Get course for audit
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    // Check if course has active classes or enrollments
    const courseWithRelations = await prisma.course.findUnique({
      where: { id },
      include: {
        classes: true,
        enrollments: true
      }
    });

    if (courseWithRelations?.classes.length || courseWithRelations?.enrollments.length) {
      return NextResponse.json(
        { error: 'Não é possível excluir curso com turmas ou matrículas ativas' },
        { status: 400 }
      );
    }

    await prisma.course.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'courses',
        recordId: id,
        oldValues: JSON.stringify(course)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User deleted course: ${course.name}`,
        metadata: JSON.stringify({ courseId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
