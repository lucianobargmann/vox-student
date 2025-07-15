import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { whatsAppLogger, LogLevel } from '@/lib/whatsapp-logger';

// GET /api/whatsapp/logs - Get WhatsApp logs
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const level = searchParams.get('level') as LogLevel | null;
    const hours = parseInt(searchParams.get('hours') || '24');

    // Get recent logs
    const logs = await whatsAppLogger.getRecentLogs(limit, level || undefined);

    // Get log statistics
    const statistics = await whatsAppLogger.getLogStatistics(hours);

    return NextResponse.json({
      logs,
      statistics,
      filters: {
        limit,
        level,
        hours
      }
    });

  } catch (error) {
    console.error('❌ Error getting WhatsApp logs:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/whatsapp/logs - Clean up old logs
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Check if user is admin
    if (!['admin', 'super_admin'].includes(authResult.user.profile?.role || '')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Dias deve estar entre 1 e 365' },
        { status: 400 }
      );
    }

    // Clean up old logs
    const deletedCount = await whatsAppLogger.cleanupOldLogs(days);

    return NextResponse.json({
      success: true,
      message: `${deletedCount} logs antigos foram removidos`,
      deletedCount
    });

  } catch (error) {
    console.error('❌ Error cleaning up WhatsApp logs:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
