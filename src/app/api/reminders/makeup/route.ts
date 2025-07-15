import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { ReminderService } from '@/lib/reminder-service';
import { prisma } from '@/lib/prisma';

// POST /api/reminders/makeup - Send makeup class reminders
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { classId, makeupDate } = body;

    // Validate required fields
    if (!classId || !makeupDate) {
      return NextResponse.json(
        { error: 'ID da turma e data de reposição são obrigatórios' },
        { status: 400 }
      );
    }

    // Validate makeup date
    const makeupDateTime = new Date(makeupDate);
    if (isNaN(makeupDateTime.getTime())) {
      return NextResponse.json(
        { error: 'Data de reposição inválida' },
        { status: 400 }
      );
    }

    // Check if makeup date is in the future
    if (makeupDateTime <= new Date()) {
      return NextResponse.json(
        { error: 'Data de reposição deve ser no futuro' },
        { status: 400 }
      );
    }

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        course: {
          select: {
            name: true,
            allowsMakeup: true
          }
        },
        _count: {
          select: {
            enrollments: {
              where: {
                status: 'active'
              }
            }
          }
        }
      }
    });

    if (!classData) {
      return NextResponse.json(
        { error: 'Turma não encontrada' },
        { status: 404 }
      );
    }

    // Check if course allows makeup classes
    if (!classData.course.allowsMakeup) {
      return NextResponse.json(
        { error: 'Este curso não permite aulas de reposição' },
        { status: 400 }
      );
    }

    // Check if WhatsApp is enabled
    const whatsappSettings = await prisma.whatsAppSettings.findFirst();
    if (!whatsappSettings?.enabled) {
      return NextResponse.json(
        { error: 'WhatsApp não está habilitado' },
        { status: 400 }
      );
    }

    // Send makeup reminders
    await ReminderService.sendMakeupReminders(classId, makeupDateTime);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'SEND_MAKEUP_REMINDERS',
        tableName: 'whatsapp_messages',
        recordId: classId,
        newValues: JSON.stringify({
          classId,
          makeupDate: makeupDateTime,
          className: classData.name,
          courseName: classData.course.name,
          enrolledStudents: classData._count.enrollments,
          triggeredBy: authResult.user.email
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Lembretes de reposição enviados para ${classData._count.enrollments} alunos da turma ${classData.name}`,
      details: {
        className: classData.name,
        courseName: classData.course.name,
        makeupDate: makeupDateTime,
        studentsNotified: classData._count.enrollments
      }
    });

  } catch (error) {
    console.error('❌ Error sending makeup reminders:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
