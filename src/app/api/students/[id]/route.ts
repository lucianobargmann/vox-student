import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/students/[id] - Get a specific student
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

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
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
                endDate: true
              }
            }
          }
        },
        attendance: {
          include: {
            lesson: {
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
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            attendance: true,
            enrollments: true
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: student });
  } catch (error) {
    console.error('Get student error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/students/[id] - Update a student
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
    const { name, email, phone, birthDate, notes, status } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome do aluno é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldStudent = await prisma.student.findUnique({
      where: { id }
    });

    if (!oldStudent) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    // Check if email already exists (excluding current student)
    if (email && email !== oldStudent.email) {
      const existingStudent = await prisma.student.findFirst({
        where: {
          email: email.trim(),
          id: { not: id }
        }
      });
      if (existingStudent) {
        return NextResponse.json(
          { error: 'Email já cadastrado' },
          { status: 400 }
        );
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes: notes?.trim() || null,
        status: status || oldStudent.status
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'students',
        recordId: student.id,
        oldValues: JSON.stringify(oldStudent),
        newValues: JSON.stringify(student)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated student: ${student.name}`,
        metadata: JSON.stringify({ studentId: student.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: student });
  } catch (error) {
    console.error('Update student error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/students/[id] - Delete a student
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

    // Get student for audit
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: true,
        attendance: true
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    // Check if student has enrollments or attendance records
    if (student.enrollments.length || student.attendance.length) {
      return NextResponse.json(
        { error: 'Não é possível excluir aluno com matrículas ou registros de presença' },
        { status: 400 }
      );
    }

    await prisma.student.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'students',
        recordId: id,
        oldValues: JSON.stringify(student)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User deleted student: ${student.name}`,
        metadata: JSON.stringify({ studentId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
