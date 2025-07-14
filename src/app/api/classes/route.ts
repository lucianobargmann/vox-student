import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/classes - List all classes
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const search = searchParams.get('search');

    let whereClause: any = {};
    if (courseId) {
      whereClause.courseId = courseId;
    }
    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            allowsMakeup: true
          }
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true
          }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed classes list`,
        metadata: JSON.stringify({ courseId, search }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: classes });
  } catch (error) {
    console.error('Get classes error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/classes - Create a new class
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, name, description, startDate, endDate, schedule, maxStudents } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'ID do curso é obrigatório' },
        { status: 400 }
      );
    }

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

    const classData = await prisma.class.create({
      data: {
        courseId,
        name: name.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        schedule: schedule ? JSON.stringify(schedule) : null,
        maxStudents: maxStudents ? parseInt(maxStudents) : null
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
        action: 'CREATE',
        tableName: 'classes',
        recordId: classData.id,
        newValues: JSON.stringify(classData)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User created class: ${classData.name}`,
        metadata: JSON.stringify({ classId: classData.id, courseId }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: classData }, { status: 201 });
  } catch (error) {
    console.error('Create class error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
