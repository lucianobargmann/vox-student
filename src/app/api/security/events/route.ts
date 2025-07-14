import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/security/events - List security events
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: authResult.user.id }
    });

    if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const eventType = searchParams.get('eventType');
    const severity = searchParams.get('severity');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const skip = (page - 1) * limit;

    let whereClause: any = {};
    
    if (eventType) {
      whereClause.eventType = eventType;
    }
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    if (userId) {
      whereClause.userId = userId;
    }
    
    if (dateFrom || dateTo) {
      whereClause.timestamp = {};
      if (dateFrom) {
        whereClause.timestamp.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.timestamp.lte = new Date(dateTo);
      }
    }

    const [events, totalCount] = await Promise.all([
      prisma.securityEvent.findMany({
        where: whereClause,
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
        skip,
        take: limit
      }),
      prisma.securityEvent.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: events,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get security events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/security/events - Create a security event (for system use)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventType, severity, description, metadata } = body;

    if (!eventType || !severity || !description) {
      return NextResponse.json(
        { error: 'eventType, severity, and description are required' },
        { status: 400 }
      );
    }

    const securityEvent = await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType,
        severity,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: securityEvent }, { status: 201 });
  } catch (error) {
    console.error('Create security event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
