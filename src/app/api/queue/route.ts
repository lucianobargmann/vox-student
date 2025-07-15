import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { messageQueue } from '@/lib/message-queue';
import { prisma } from '@/lib/prisma';

// GET /api/queue - Get queue status and statistics
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // Get queue statistics
    const stats = await messageQueue.getQueueStats();

    // Build where clause for filtering
    let whereClause: any = {};
    if (status && ['pending', 'processing', 'sent', 'failed', 'cancelled'].includes(status)) {
      whereClause.status = status;
    }

    // Get queue entries
    const [queueEntries, total] = await Promise.all([
      prisma.messageQueue.findMany({
        where: whereClause,
        orderBy: [
          { priority: 'asc' },
          { scheduledFor: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
        select: {
          id: true,
          recipientPhone: true,
          messageText: true,
          messageType: true,
          priority: true,
          scheduledFor: true,
          attempts: true,
          maxAttempts: true,
          status: true,
          sentAt: true,
          lastAttemptAt: true,
          errorMessage: true,
          createdAt: true
        }
      }),
      prisma.messageQueue.count({ where: whereClause })
    ]);

    return NextResponse.json({
      statistics: stats,
      queue: queueEntries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error getting queue status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/queue - Add message to queue
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      recipientPhone, 
      messageText, 
      messageType = 'general',
      priority = 3,
      scheduledFor,
      maxAttempts = 3,
      metadata 
    } = body;

    // Validate required fields
    if (!recipientPhone || !messageText) {
      return NextResponse.json(
        { error: 'Número de telefone e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{10,14}$/;
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Formato de telefone inválido' },
        { status: 400 }
      );
    }

    // Validate priority
    if (priority < 1 || priority > 5) {
      return NextResponse.json(
        { error: 'Prioridade deve estar entre 1 e 5' },
        { status: 400 }
      );
    }

    // Validate scheduled date if provided
    let scheduledDate = scheduledFor ? new Date(scheduledFor) : new Date();
    if (scheduledFor && isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Data de agendamento inválida' },
        { status: 400 }
      );
    }

    // Add message to queue
    const messageId = await messageQueue.enqueue({
      recipientPhone,
      messageText,
      messageType,
      priority,
      scheduledFor: scheduledDate,
      maxAttempts,
      metadata
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'QUEUE_MESSAGE',
        tableName: 'message_queue',
        recordId: messageId,
        newValues: JSON.stringify({
          recipientPhone,
          messageType,
          priority,
          scheduledFor: scheduledDate,
          messageLength: messageText.length
        })
      }
    });

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Mensagem adicionada à fila com sucesso'
    });

  } catch (error) {
    console.error('❌ Error adding message to queue:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/queue - Cancel queued message
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { error: 'ID da mensagem é obrigatório' },
        { status: 400 }
      );
    }

    // Cancel the message
    const cancelled = await messageQueue.cancelMessage(messageId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Mensagem não encontrada ou não pode ser cancelada' },
        { status: 404 }
      );
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CANCEL_QUEUED_MESSAGE',
        tableName: 'message_queue',
        recordId: messageId,
        newValues: JSON.stringify({ cancelledBy: authResult.user.email })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Mensagem cancelada com sucesso'
    });

  } catch (error) {
    console.error('❌ Error cancelling queued message:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
