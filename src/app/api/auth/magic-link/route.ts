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

    // Special case: Super admin and admin users can login even if not in database
    if (!user && (isSuperAdminEmail(emailLower) || isAdminEmail(emailLower))) {
      const isSuperAdmin = isSuperAdminEmail(emailLower);
      console.log(`🔑 Creating ${isSuperAdmin ? 'super admin' : 'admin'} user on first login: ${emailLower}`);

      // Create admin user on first login
      user = await prisma.user.create({
        data: {
          email: emailLower,
          emailVerified: true,
          profile: {
            create: {
              fullName: isSuperAdmin ? 'Super Admin' : 'Admin',
              role: isSuperAdmin ? 'super_admin' : 'admin'
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

    // Update existing user's role if they're in admin emails but don't have admin role
    if (user && user.profile) {
      const isSuperAdmin = isSuperAdminEmail(emailLower);
      const isAdmin = isAdminEmail(emailLower);
      const currentRole = user.profile.role;

      let shouldUpdateRole = false;
      let newRole = currentRole;

      if (isSuperAdmin && currentRole !== 'super_admin') {
        newRole = 'super_admin';
        shouldUpdateRole = true;
      } else if (isAdmin && !['admin', 'super_admin'].includes(currentRole)) {
        newRole = 'admin';
        shouldUpdateRole = true;
      }

      if (shouldUpdateRole) {
        console.log(`🔄 Updating user role from ${currentRole} to ${newRole} for: ${emailLower}`);
        await prisma.userProfile.update({
          where: { userId: user.id },
          data: { role: newRole }
        });
        // Update the user object to reflect the change
        user.profile.role = newRole;
      }
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
