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
