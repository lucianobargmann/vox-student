import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

// POST /api/whatsapp/send - Send a WhatsApp message
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { phoneNumber, message, messageType } = body;

    // Validate required fields
    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{10,14}$/;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Formato de telefone inválido' },
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

    // Send the message
    const result = await sendWhatsAppMessage(phoneNumber, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Falha ao enviar mensagem' },
        { status: 500 }
      );
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'SEND_WHATSAPP',
        tableName: 'whatsapp_messages',
        recordId: result.messageId || 'unknown',
        newValues: JSON.stringify({
          phoneNumber,
          messageType,
          messageLength: message.length
        })
      }
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Mensagem enviada com sucesso'
    });

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET /api/whatsapp/send - Get recent sent messages (for admin interface)
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

    let whereClause: any = {};
    if (status) {
      whereClause.deliveryStatus = status;
    }

    const [messages, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          recipientPhone: true,
          messageText: true,
          messageId: true,
          messageType: true,
          sentAt: true,
          deliveryStatus: true,
          errorMessage: true,
          createdAt: true
        }
      }),
      prisma.whatsAppMessage.count({ where: whereClause })
    ]);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching WhatsApp messages:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
