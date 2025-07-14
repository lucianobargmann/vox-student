import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/security/dashboard - Get security dashboard data
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Check if user is admin (assuming admin role check)
    // You might need to adjust this based on your role system
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: authResult.user.id }
    });

    if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Get security events statistics
    const securityEvents = await prisma.securityEvent.findMany({
      where: {
        timestamp: {
          gte: dateFrom
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    // Get audit logs statistics
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: dateFrom
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    // Calculate statistics
    const eventsByType = securityEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = securityEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const actionsByType = auditLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const actionsByTable = auditLogs.reduce((acc, log) => {
      acc[log.tableName] = (acc[log.tableName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get recent failed login attempts
    const failedLogins = securityEvents.filter(event => 
      event.eventType === 'login_failed' || event.eventType === 'invalid_token'
    );

    // Get active users (users who performed actions in the period)
    const activeUsers = [...new Set([
      ...securityEvents.map(e => e.userId).filter(Boolean),
      ...auditLogs.map(l => l.userId).filter(Boolean)
    ])];

    const dashboardData = {
      summary: {
        totalSecurityEvents: securityEvents.length,
        totalAuditLogs: auditLogs.length,
        failedLoginAttempts: failedLogins.length,
        activeUsers: activeUsers.length
      },
      statistics: {
        eventsByType,
        eventsBySeverity,
        actionsByType,
        actionsByTable
      },
      recentEvents: securityEvents.slice(0, 20),
      recentAuditLogs: auditLogs.slice(0, 20),
      failedLogins: failedLogins.slice(0, 10)
    };

    // Log access to security dashboard
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'security_dashboard_access',
        severity: 'low',
        description: `Admin accessed security dashboard`,
        metadata: JSON.stringify({ days }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: dashboardData });
  } catch (error) {
    console.error('Get security dashboard error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
