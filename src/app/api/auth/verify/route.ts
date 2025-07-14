import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 });
    }

    // Find magic link
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!magicLink) {
      return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
    }

    if (magicLink.usedAt) {
      return NextResponse.json({ error: 'Link já foi utilizado' }, { status: 400 });
    }

    if (new Date() > magicLink.expiresAt) {
      return NextResponse.json({ error: 'Link expirado' }, { status: 400 });
    }

    // Mark magic link as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() }
    });

    // Update user last login
    await prisma.user.update({
      where: { id: magicLink.user.id },
      data: { 
        lastLoginAt: new Date(),
        emailVerified: true
      }
    });

    // Create session with unique token
    const sessionToken = jwt.sign(
      {
        userId: magicLink.user.id,
        email: magicLink.user.email,
        sessionId: crypto.randomBytes(16).toString('hex') // Add unique session ID
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${parseInt(process.env.SESSION_EXPIRY_DAYS || '30')}d` }
    );

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + parseInt(process.env.SESSION_EXPIRY_DAYS || '30'));

    // Delete any existing sessions for this user to prevent token conflicts
    await prisma.session.deleteMany({
      where: { userId: magicLink.user.id }
    });

    // Create new session
    await prisma.session.create({
      data: {
        userId: magicLink.user.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt
      }
    });

    return NextResponse.json({
      token: sessionToken,
      user: {
        id: magicLink.user.id,
        email: magicLink.user.email,
        profile: magicLink.user.profile
      }
    });

  } catch (error) {
    console.error('Error verifying magic link:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
