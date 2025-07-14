import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/students - List all students
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) {
      whereClause.status = status;
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        enrollments: {
          include: {
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
        },
        _count: {
          select: {
            attendance: true,
            enrollments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed students list`,
        metadata: JSON.stringify({ search, status }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: students });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/students - Create a new student
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, birthDate, notes } = body;

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

    // Check if email already exists
    if (email) {
      const existingStudent = await prisma.student.findFirst({
        where: { email: email.trim() }
      });
      if (existingStudent) {
        return NextResponse.json(
          { error: 'Email já cadastrado' },
          { status: 400 }
        );
      }
    }

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes: notes?.trim() || null
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'students',
        recordId: student.id,
        newValues: JSON.stringify(student)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User created student: ${student.name}`,
        metadata: JSON.stringify({ studentId: student.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
