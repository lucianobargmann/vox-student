import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getWhatsAppConnectionStatus, verifyWhatsAppConnection, restartWhatsAppService } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

// GET /api/whatsapp/status - Get WhatsApp connection status
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Get connection status from service
    const connectionStatus = await getWhatsAppConnectionStatus();
    
    // Get settings from database
    const settings = await prisma.whatsAppSettings.findFirst();
    
    // Get recent message statistics
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const [totalMessages, sentMessages, failedMessages, recentMessages] = await Promise.all([
      prisma.whatsAppMessage.count(),
      prisma.whatsAppMessage.count({
        where: { deliveryStatus: 'sent' }
      }),
      prisma.whatsAppMessage.count({
        where: { deliveryStatus: 'failed' }
      }),
      prisma.whatsAppMessage.count({
        where: {
          createdAt: { gte: last24Hours }
        }
      })
    ]);

    return NextResponse.json({
      connection: {
        isReady: connectionStatus.isReady,
        isInitializing: connectionStatus.isInitializing,
        qrCode: connectionStatus.qrCode,
        isAuthenticated: settings?.isAuthenticated || false,
        phoneNumber: settings?.phoneNumber,
        lastConnectionCheck: settings?.lastConnectionCheck
      },
      settings: {
        enabled: settings?.enabled || false,
        rateLimitSeconds: settings?.rateLimitSeconds || 30
      },
      statistics: {
        totalMessages,
        sentMessages,
        failedMessages,
        recentMessages,
        successRate: totalMessages > 0 ? ((sentMessages / totalMessages) * 100).toFixed(1) : '0'
      }
    });

  } catch (error) {
    console.error('❌ Error getting WhatsApp status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/whatsapp/status - Update WhatsApp connection (restart, verify, etc.)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    let result: any = {};

    switch (action) {
      case 'verify':
        const isConnected = await verifyWhatsAppConnection();
        result = { 
          success: isConnected,
          message: isConnected ? 'Conexão verificada com sucesso' : 'Falha na verificação da conexão'
        };
        
        // Update database settings
        await prisma.whatsAppSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            enabled: true,
            isAuthenticated: isConnected,
            lastConnectionCheck: new Date()
          },
          update: {
            isAuthenticated: isConnected,
            lastConnectionCheck: new Date()
          }
        });
        break;

      case 'restart':
        await restartWhatsAppService();
        result = {
          success: true,
          message: 'Verificando conexão WhatsApp...'
        };

        // Update database settings
        await prisma.whatsAppSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            enabled: true,
            isAuthenticated: false,
            lastConnectionCheck: new Date()
          },
          update: {
            isAuthenticated: false,
            lastConnectionCheck: new Date(),
            qrCode: null // Clear old QR code
          }
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Ação inválida' },
          { status: 400 }
        );
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: `WHATSAPP_${action.toUpperCase()}`,
        tableName: 'whatsapp_settings',
        recordId: 'default',
        newValues: JSON.stringify({ action, timestamp: new Date() })
      }
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error updating WhatsApp status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
