/**
 * Role checking utilities
 * Centralized role validation to ensure consistency across the application
 */

export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

export interface UserProfile {
  role?: UserRole | string | null;
}

export interface User {
  id: string;
  email: string;
  profile?: UserProfile | null;
}

/**
 * Check if user has super admin role
 */
export function isSuperAdmin(user?: User | null): boolean {
  return user?.profile?.role === 'super_admin';
}

/**
 * Check if user has admin role (regular admin, not super admin)
 */
export function isAdmin(user?: User | null): boolean {
  return user?.profile?.role === 'admin';
}

/**
 * Check if user has admin or super admin role
 */
export function isAdminOrSuperAdmin(user?: User | null): boolean {
  const role = user?.profile?.role;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Check if user has teacher role
 */
export function isTeacher(user?: User | null): boolean {
  return user?.profile?.role === 'teacher';
}

/**
 * Check if user has teacher, admin, or super admin role
 */
export function isTeacherOrAdmin(user?: User | null): boolean {
  const role = user?.profile?.role;
  return role === 'teacher' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if user has student role
 */
export function isStudent(user?: User | null): boolean {
  return user?.profile?.role === 'student';
}

/**
 * Check if user has any authenticated role
 */
export function isAuthenticated(user?: User | null): boolean {
  return !!user?.profile?.role;
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role?: UserRole | null): string {
  switch (role) {
    case 'super_admin':
      return 'Super Administrador';
    case 'admin':
      return 'Administrador';
    case 'teacher':
      return 'Professor';
    case 'student':
      return 'Aluno';
    default:
      return 'Sem função';
  }
}

/**
 * Get all available roles
 */
export function getAllRoles(): { value: UserRole; label: string }[] {
  return [
    { value: 'student', label: 'Aluno' },
    { value: 'teacher', label: 'Professor' },
    { value: 'admin', label: 'Administrador' },
    { value: 'super_admin', label: 'Super Administrador' },
  ];
}

/**
 * Check if user can access admin features
 */
export function canAccessAdmin(user?: User | null): boolean {
  return isAdminOrSuperAdmin(user);
}

/**
 * Check if user can manage users
 */
export function canManageUsers(user?: User | null): boolean {
  return isAdminOrSuperAdmin(user);
}

/**
 * Check if user can manage courses
 */
export function canManageCourses(user?: User | null): boolean {
  return isAdminOrSuperAdmin(user);
}

/**
 * Check if user can manage classes
 */
export function canManageClasses(user?: User | null): boolean {
  return isAdminOrSuperAdmin(user);
}

/**
 * Check if user can view students
 */
export function canViewStudents(user?: User | null): boolean {
  return isTeacherOrAdmin(user);
}

/**
 * Check if user can manage students
 */
export function canManageStudents(user?: User | null): boolean {
  return isAdminOrSuperAdmin(user);
}

/**
 * Check if user can access system settings
 */
export function canAccessSystemSettings(user?: User | null): boolean {
  return isSuperAdmin(user);
}
