import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMagicLink } from '@/lib/whatsapp';
import { isAdminPhone, isSuperAdminPhone, isStudentPhone, getStudentByPhone } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json({ error: 'Número de telefone é obrigatório' }, { status: 400 });
    }

    // Basic phone number validation
    const phoneRegex = /^[\+]?[1-9][\d]{10,14}$/;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json({ error: 'Formato de telefone inválido' }, { status: 400 });
    }

    // Check if WhatsApp is enabled
    const whatsappSettings = await prisma.whatsAppSettings.findFirst();
    if (!whatsappSettings?.enabled || !whatsappSettings?.isAuthenticated) {
      return NextResponse.json({ 
        error: 'WhatsApp não está disponível no momento' 
      }, { status: 503 });
    }

    // Check if user exists in the system by phone number
    let user = await prisma.user.findFirst({
      where: {
        profile: {
          phone: phoneNumber
        }
      },
      include: {
        profile: true
      }
    });

    // If user doesn't exist, check if this phone number is authorized
    if (!user) {
      const isAdmin = isAdminPhone(phoneNumber) || isSuperAdminPhone(phoneNumber);
      const isStudent = await isStudentPhone(phoneNumber);

      if (!isAdmin && !isStudent) {
        return NextResponse.json({
          error: 'Número de telefone não autorizado. Apenas administradores e estudantes cadastrados podem fazer login via WhatsApp.'
        }, { status: 403 });
      }

      // Create user profile for authorized phone number
      const email = `${cleanPhone}@whatsapp.voxstudent.com`; // Generate email from phone
      let userName = `WhatsApp User ${cleanPhone}`;
      let userRole = 'user';

      // If it's an admin
      if (isAdmin) {
        userRole = isSuperAdminPhone(phoneNumber) ? 'super_admin' : 'admin';
      }
      // If it's a student, get their name
      else if (isStudent) {
        const student = await getStudentByPhone(phoneNumber);
        if (student) {
          userName = student.name;
          userRole = 'student';
        }
      }

      user = await prisma.user.create({
        data: {
          email: email,
          emailVerified: false,
          profile: {
            create: {
              name: userName,
              phone: phoneNumber,
              role: userRole
            }
          }
        },
        include: {
          profile: true
        }
      });
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '15') * 60 * 1000));

    // Store magic link in database
    await prisma.magicLink.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        used: false
      }
    });

    // Send magic link via WhatsApp
    try {
      const result = await sendWhatsAppMagicLink(phoneNumber, token);
      
      if (!result.success) {
        console.error('❌ Failed to send WhatsApp magic link:', result.error);
        return NextResponse.json({ 
          error: 'Falha ao enviar link de acesso via WhatsApp' 
        }, { status: 500 });
      }

      console.log('✅ WhatsApp magic link sent successfully to:', phoneNumber);
    } catch (whatsappError) {
      console.error('❌ Failed to send WhatsApp magic link:', whatsappError);
      // Don't fail the request if WhatsApp fails - user can still use the link if they have it
    }

    const magicLinkUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}`;

    return NextResponse.json({
      message: 'Link de acesso enviado via WhatsApp',
      // In development, return the token for testing
      ...(process.env.NODE_ENV === 'development' && { token, magicLinkUrl })
    });

  } catch (error) {
    console.error('❌ Error in WhatsApp magic link:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
