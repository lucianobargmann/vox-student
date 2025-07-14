import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

      // Delete the session
      await prisma.session.deleteMany({
        where: {
          token,
          userId: decoded.userId
        }
      });

    } catch {
      // Even if JWT is invalid, try to delete the session by token
      await prisma.session.deleteMany({
        where: { token }
      });
    }

    return NextResponse.json({ message: 'Logout realizado com sucesso' });

  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
