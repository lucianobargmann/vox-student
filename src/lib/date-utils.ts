/**
 * Date utility functions for consistent date handling across the application
 * Handles timezone conversions between local time and UTC for storage
 */

/**
 * Convert a local date string (YYYY-MM-DD) to UTC ISO string for database storage
 * @param dateString - Date string in YYYY-MM-DD format from date input
 * @returns ISO string in UTC timezone or null if no date provided
 */
export function convertLocalDateToUTC(dateString: string | null): string | null {
  if (!dateString) return null;
  
  // Create date in local timezone (YYYY-MM-DD becomes local midnight)
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day); // month is 0-indexed
  return localDate.toISOString();
}

/**
 * Convert a UTC date string from database to local date string for date input (YYYY-MM-DD)
 * @param dateString - ISO date string from database
 * @returns Date string in YYYY-MM-DD format for date input
 */
export function convertUTCToLocalDateInput(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display in Brazilian format (DD/MM/YYYY)
 * @param dateString - ISO date string from database
 * @returns Formatted date string in DD/MM/YYYY format
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Create a local date object from year, month, and day
 * Useful for creating dates that should be interpreted in local timezone
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12, not 0-indexed)
 * @param day - Day of month (1-31)
 * @returns Date object in local timezone
 */
export function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
}

/**
 * Get the day of week name in Portuguese
 * @param dateString - ISO date string or Date object
 * @returns Day name in Portuguese
 */
export function getDayOfWeekName(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return dayNames[date.getDay()];
}

/**
 * Get the day of week name in English (for debugging)
 * @param dateString - ISO date string or Date object
 * @returns Day name in English
 */
export function getDayOfWeekNameEn(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[date.getDay()];
}

/**
 * Check if two dates are on the same day of the week
 * @param date1 - First date (ISO string or Date object)
 * @param date2 - Second date (ISO string or Date object)
 * @returns True if both dates are on the same day of the week
 */
export function isSameDayOfWeek(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return d1.getDay() === d2.getDay();
}

/**
 * Add weeks to a date
 * @param date - Starting date
 * @param weeks - Number of weeks to add
 * @returns New date with weeks added
 */
export function addWeeks(date: Date, weeks: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + (weeks * 7));
  return newDate;
}

/**
 * Format date and time for display in Brazilian format
 * @param dateString - ISO date string from database
 * @returns Formatted date and time string
 */
export function formatDateTimeForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
