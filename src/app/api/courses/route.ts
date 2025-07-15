import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/courses - List all courses
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    console.log('🔍 COURSES API DEBUG:', {
      url: request.url,
      search,
      searchParams: Object.fromEntries(searchParams.entries())
    });

    let whereClause = {};
    if (search) {
      whereClause = {
        name: {
          contains: search
        }
      };
    }

    console.log('🔍 COURSES WHERE CLAUSE:', whereClause);

    const courses = await prisma.course.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            classes: true,
            enrollments: true
          }
        }
      }
    });

    console.log('🔍 COURSES FOUND:', courses.length, courses.map(c => ({ id: c.id, name: c.name })));

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed courses list`,
        metadata: JSON.stringify({ search }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: courses });
  } catch (error) {
    console.error('Get courses error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/courses - Create a new course
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, duration, numberOfLessons, price, allowsMakeup } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome do curso é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        duration: duration ? parseInt(duration) : null,
        numberOfLessons: numberOfLessons ? parseInt(numberOfLessons) : null,
        price: price ? parseFloat(price) : null,
        allowsMakeup: allowsMakeup || false
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'courses',
        recordId: course.id,
        newValues: JSON.stringify(course)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User created course: ${course.name}`,
        metadata: JSON.stringify({ courseId: course.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: course }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
