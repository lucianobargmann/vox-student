import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

/**
 * Check if an email is configured as admin in environment variables
 */
export function isAdminEmail(email: string): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  
  const normalizedEmail = email.toLowerCase();
  
  // Check if it's the super admin
  if (superAdminEmail && normalizedEmail === superAdminEmail.toLowerCase()) {
    return true;
  }
  
  // Check if it's in the admin emails list
  return adminEmails.includes(normalizedEmail);
}

/**
 * Check if an email is the super admin
 */
export function isSuperAdminEmail(email: string): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  return superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase();
}

/**
 * Check if a phone number is configured as admin in environment variables
 */
export function isAdminPhone(phoneNumber: string): boolean {
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
  const adminPhones = process.env.ADMIN_PHONES?.split(',').map(p => p.trim().replace(/\D/g, '')) || [];

  const normalizedPhone = phoneNumber.replace(/\D/g, '');

  // Check if it's the super admin phone
  if (superAdminPhone && normalizedPhone === superAdminPhone.replace(/\D/g, '')) {
    return true;
  }

  // Check if it's in the admin phones list
  return adminPhones.includes(normalizedPhone);
}

/**
 * Check if a phone number is the super admin
 */
export function isSuperAdminPhone(phoneNumber: string): boolean {
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
  return superAdminPhone && phoneNumber.replace(/\D/g, '') === superAdminPhone.replace(/\D/g, '');
}

/**
 * Check if a phone number belongs to a registered student
 */
export async function isStudentPhone(phoneNumber: string): Promise<boolean> {
  try {
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    const student = await prisma.student.findFirst({
      where: {
        phone: {
          contains: normalizedPhone
        },
        status: 'active'
      }
    });

    return !!student;
  } catch (error) {
    console.error('Error checking student phone:', error);
    return false;
  }
}

/**
 * Get student by phone number
 */
export async function getStudentByPhone(phoneNumber: string) {
  try {
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    return await prisma.student.findFirst({
      where: {
        phone: {
          contains: normalizedPhone
        },
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Error getting student by phone:', error);
    return null;
  }
}

/**
 * Verify authentication from request headers
 * Returns an object with success boolean and user data if successful
 */
export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, user: null };
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
      return { success: false, user: null };
    }

    return { success: true, user: session.user };
  } catch (error) {
    return { success: false, user: null };
  }
}

/**
 * Verify admin access from request headers
 */
export async function verifyAdminAccess(request: NextRequest) {
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

    // Check if user is admin
    if (!isAdminEmail(session.user.email)) {
      return null;
    }

    return session.user;
  } catch (error) {
    return null;
  }
}

/**
 * Get user role based on email and profile
 */
export function getUserRole(email: string, profileRole?: string): string {
  if (isSuperAdminEmail(email)) {
    return 'super_admin';
  }
  
  if (isAdminEmail(email)) {
    return 'admin';
  }
  
  return profileRole || 'user';
}

/**
 * Validate admin configuration on startup
 * This should be called on application startup to verify environment configuration
 */
export function validateAdminConfiguration() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

  if (!superAdminEmail) {
    console.log('⚠️  No SUPER_ADMIN_EMAIL configured in environment variables');
    return false;
  }

  // Super admin and admin emails configured successfully

  return true;
}

export function isUserAdmin(userRole?: string | null): boolean {
  return userRole === 'admin' || userRole === 'super_admin';
}

export function isUserSuperAdmin(userRole?: string | null): boolean {
  return userRole === 'super_admin';
}
