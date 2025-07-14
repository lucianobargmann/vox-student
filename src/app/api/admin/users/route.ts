import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Super admin email - only this user can create new users
const SUPER_ADMIN_EMAIL = 'luciano@hcktplanet.com';

async function verifyAdminAccess(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
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
      return null;
    }

    // Check if user is super admin
    if (session.user.email !== SUPER_ADMIN_EMAIL) {
      return null;
    }

    return session.user;
  } catch (error) {
    return null;
  }
}

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAccess(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: {
        profile: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ users });

  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAccess(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { email, fullName, role = 'user' } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email válido é obrigatório' }, { status: 400 });
    }

    if (!fullName || fullName.trim().length === 0) {
      return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Usuário já existe no sistema' }, { status: 400 });
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        profile: {
          create: {
            fullName: fullName.trim(),
            role: role
          }
        }
      },
      include: {
        profile: true
      }
    });

    console.log(`✅ New user created by admin: ${email} (${fullName})`);

    return NextResponse.json({
      message: 'Usuário criado com sucesso',
      user: {
        id: newUser.id,
        email: newUser.email,
        profile: newUser.profile
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Remove user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAccess(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    // Prevent admin from deleting themselves
    if (userId === adminUser.id) {
      return NextResponse.json({ error: 'Não é possível deletar sua própria conta' }, { status: 400 });
    }

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Prevent deletion of super admin
    if (userToDelete.email === SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Não é possível deletar o super admin' }, { status: 400 });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`✅ User deleted by admin: ${userToDelete.email} (${userToDelete.profile?.fullName})`);

    return NextResponse.json({
      message: 'Usuário removido com sucesso'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
