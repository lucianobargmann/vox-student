import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    jwt.verify(token, process.env.JWT_SECRET!);

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!session || new Date() > session.expiresAt) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        profile: session.user.profile
      }
    });

  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
}
