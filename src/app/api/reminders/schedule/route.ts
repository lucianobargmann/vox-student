import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { ReminderService } from '@/lib/reminder-service';
import { prisma } from '@/lib/prisma';

// POST /api/reminders/schedule - Manually trigger reminder scheduling
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { hoursBeforeClass = 24, type = 'auto' } = body;

    // Validate hours before class
    if (typeof hoursBeforeClass !== 'number' || hoursBeforeClass < 1 || hoursBeforeClass > 168) {
      return NextResponse.json(
        { error: 'Horas antes da aula deve estar entre 1 e 168' },
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

    // Schedule reminders
    await ReminderService.scheduleReminders(hoursBeforeClass);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'SCHEDULE_REMINDERS',
        tableName: 'whatsapp_messages',
        recordId: 'bulk',
        newValues: JSON.stringify({
          hoursBeforeClass,
          type,
          triggeredBy: authResult.user.email
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Lembretes agendados para ${hoursBeforeClass} horas antes das aulas`
    });

  } catch (error) {
    console.error('❌ Error scheduling reminders:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET /api/reminders/schedule - Get reminder statistics
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    // Get reminder statistics
    const statistics = await ReminderService.getReminderStatistics(days);

    // Get recent reminders
    const recentReminders = await prisma.whatsAppMessage.findMany({
      where: {
        messageType: { in: ['aula', 'reposicao', 'mentoria'] },
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        recipientPhone: true,
        messageType: true,
        deliveryStatus: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true
      }
    });

    // Get upcoming lessons that need reminders
    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        scheduledDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        },
        status: 'scheduled'
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            course: {
              select: {
                name: true
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
        }
      },
      orderBy: { scheduledDate: 'asc' },
      take: 10
    });

    return NextResponse.json({
      statistics,
      recentReminders,
      upcomingLessons: upcomingLessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        scheduledDate: lesson.scheduledDate,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        class: {
          name: lesson.class.name,
          course: lesson.class.course.name,
          enrolledStudents: lesson.class._count.enrollments
        }
      }))
    });

  } catch (error) {
    console.error('❌ Error getting reminder statistics:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
