import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/whatsapp/settings - Get WhatsApp settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    let settings = await prisma.whatsAppSettings.findFirst();

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.whatsAppSettings.create({
        data: {
          id: 'default',
          enabled: false,
          rateLimitSeconds: 30,
          isAuthenticated: false
        }
      });
    }

    return NextResponse.json({
      enabled: settings.enabled,
      isAuthenticated: settings.isAuthenticated,
      phoneNumber: settings.phoneNumber,
      rateLimitSeconds: settings.rateLimitSeconds,
      lastConnectionCheck: settings.lastConnectionCheck,
      qrCode: settings.qrCode
    });

  } catch (error) {
    console.error('❌ Error getting WhatsApp settings:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/whatsapp/settings - Update WhatsApp settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, rateLimitSeconds } = body;

    // Validate rate limit
    if (rateLimitSeconds !== undefined) {
      if (typeof rateLimitSeconds !== 'number' || rateLimitSeconds < 10 || rateLimitSeconds > 300) {
        return NextResponse.json(
          { error: 'Rate limit deve estar entre 10 e 300 segundos' },
          { status: 400 }
        );
      }
    }

    // Get current settings
    const currentSettings = await prisma.whatsAppSettings.findFirst();

    // Update settings
    const updatedSettings = await prisma.whatsAppSettings.upsert({
      where: { id: currentSettings?.id || 'default' },
      create: {
        id: 'default',
        enabled: enabled !== undefined ? enabled : false,
        rateLimitSeconds: rateLimitSeconds || 30,
        isAuthenticated: false,
        lastConnectionCheck: new Date()
      },
      update: {
        enabled: enabled !== undefined ? enabled : currentSettings?.enabled,
        rateLimitSeconds: rateLimitSeconds !== undefined ? rateLimitSeconds : currentSettings?.rateLimitSeconds,
        updatedAt: new Date()
      }
    });

    // If WhatsApp was enabled, try to initialize the service
    if (enabled === true && !currentSettings?.enabled) {
      try {
        // Import and restart WhatsApp service
        const { restartWhatsAppService } = await import('@/lib/whatsapp');
        await restartWhatsAppService();
        console.log('✅ WhatsApp service initialized after enabling');
      } catch (error) {
        console.error('❌ Failed to initialize WhatsApp service:', error);
        // Don't fail the request, just log the error
      }
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'whatsapp_settings',
        recordId: updatedSettings.id,
        oldValues: JSON.stringify(currentSettings),
        newValues: JSON.stringify(updatedSettings)
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      settings: {
        enabled: updatedSettings.enabled,
        rateLimitSeconds: updatedSettings.rateLimitSeconds,
        isAuthenticated: updatedSettings.isAuthenticated,
        phoneNumber: updatedSettings.phoneNumber,
        lastConnectionCheck: updatedSettings.lastConnectionCheck
      }
    });

  } catch (error) {
    console.error('❌ Error updating WhatsApp settings:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/whatsapp/settings - Initialize WhatsApp settings
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Check if settings already exist
    const existingSettings = await prisma.whatsAppSettings.findFirst();
    if (existingSettings) {
      return NextResponse.json(
        { error: 'Configurações já existem' },
        { status: 400 }
      );
    }

    // Create default settings
    const settings = await prisma.whatsAppSettings.create({
      data: {
        id: 'default',
        enabled: false,
        rateLimitSeconds: 30,
        isAuthenticated: false
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'whatsapp_settings',
        recordId: settings.id,
        newValues: JSON.stringify(settings)
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configurações inicializadas com sucesso',
      settings: {
        enabled: settings.enabled,
        rateLimitSeconds: settings.rateLimitSeconds,
        isAuthenticated: settings.isAuthenticated
      }
    });

  } catch (error) {
    console.error('❌ Error initializing WhatsApp settings:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
