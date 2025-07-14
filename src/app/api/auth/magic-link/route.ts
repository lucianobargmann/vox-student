import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMagicLinkEmail } from '@/lib/email';
import { isAdminEmail, isSuperAdminEmail } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email válido é obrigatório' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    // Check if user exists in the system
    let user = await prisma.user.findUnique({
      where: { email: emailLower },
      include: {
        profile: true
      }
    });

    // Special case: Super admin can login even if not in database
    // Super admin is defined via environment variables only
    if (!user && isSuperAdminEmail(emailLower)) {
      console.log(`🔑 Creating super admin user on first login: ${emailLower}`);

      // Create super admin user on first login
      user = await prisma.user.create({
        data: {
          email: emailLower,
          emailVerified: true,
          profile: {
            create: {
              fullName: 'Super Admin',
              role: 'super_admin'
            }
          }
        },
        include: {
          profile: true
        }
      });
    }

    if (!user) {
      // Security: Do not send emails to users that don't exist in the system
      // This prevents email enumeration attacks and unauthorized access attempts
      console.log(`⚠️  Magic link requested for non-existent user: ${email}`);

      // Return success message to prevent email enumeration
      // but don't actually send any email or create any records
      return NextResponse.json({
        message: 'Link de acesso enviado para seu email',
      });
    }

    // Delete any existing magic links for this user
    await prisma.magicLink.deleteMany({
      where: { userId: user.id }
    });

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '15'));

    // Create magic link
    await prisma.magicLink.create({
      data: {
        userId: user.id,
        token,
        email: email.toLowerCase(),
        expiresAt
      }
    });

    // Send magic link email
    try {
      await sendMagicLinkEmail(email.toLowerCase(), token);
      console.log('✅ Magic link email sent successfully to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send magic link email:', emailError);
      // Don't fail the request if email fails - user can still use the link if they have it
      // In development, we'll still return the token for testing
    }

    const magicLinkUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}`;

    return NextResponse.json({
      message: 'Link de acesso enviado para seu email',
      // In development, return the token for testing
      ...(process.env.NODE_ENV === 'development' && { token, magicLinkUrl })
    });

  } catch (error) {
    console.error('Error generating magic link:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
