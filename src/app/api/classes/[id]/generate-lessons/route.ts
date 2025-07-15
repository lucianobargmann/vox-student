import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';
import { ensureLessonsForClass, regenerateLessonsForClass } from '@/lib/lesson-utils';

const prisma = new PrismaClient();

// POST /api/classes/[id]/generate-lessons - Generate lessons for a class
export async function POST(
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
    const { force = false } = body; // force regeneration even if lessons exist

    // Get class with course information
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            numberOfLessons: true
          }
        },
        lessons: true
      }
    });

    if (!classData) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    if (!classData.course.numberOfLessons || classData.course.numberOfLessons <= 0) {
      return NextResponse.json(
        { error: 'O curso deve ter o número de aulas definido para gerar as aulas automaticamente' },
        { status: 400 }
      );
    }

    let lessonsGenerated = false;
    let message = '';

    if (force && classData.lessons.length > 0) {
      // Force regeneration - delete existing lessons and create new ones
      await regenerateLessonsForClass({
        classId: classData.id,
        startDate: classData.startDate,
        numberOfLessons: classData.course.numberOfLessons,
        classTime: classData.classTime || '19:00'
      });
      lessonsGenerated = true;
      message = `${classData.course.numberOfLessons} aulas foram regeneradas com sucesso`;
    } else if (classData.lessons.length === 0) {
      // Generate lessons only if none exist
      lessonsGenerated = await ensureLessonsForClass(id);
      message = lessonsGenerated 
        ? `${classData.course.numberOfLessons} aulas foram geradas com sucesso`
        : 'Nenhuma aula foi gerada';
    } else {
      // Lessons already exist and force is false
      return NextResponse.json(
        { 
          error: 'A turma já possui aulas. Use force=true para regenerar as aulas existentes',
          existingLessons: classData.lessons.length
        },
        { status: 400 }
      );
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: force ? 'REGENERATE_LESSONS' : 'GENERATE_LESSONS',
        tableName: 'lessons',
        recordId: id,
        newValues: JSON.stringify({
          classId: id,
          numberOfLessons: classData.course.numberOfLessons,
          force
        })
      }
    });

    return NextResponse.json({
      success: true,
      message,
      lessonsGenerated,
      numberOfLessons: classData.course.numberOfLessons
    });

  } catch (error) {
    console.error('Generate lessons error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
