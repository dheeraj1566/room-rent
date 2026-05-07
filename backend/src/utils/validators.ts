/**
 * Simple validation utilities
 * Clean, reusable validation functions
 */

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone number (remove spaces, dashes)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Validate Indian phone number (10 digits)
 */
export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(normalized);
}

/**
 * Validate gender value
 */
export function isValidGender(gender: unknown): gender is "Male" | "Female" | "Other" {
  return typeof gender === 'string' && ['Male', 'Female', 'Other'].includes(gender);
}

/**
 * Normalize full name (trim and capitalize)
 */
export function normalizeFullName(name: string): string {
  return name.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate password: 8–24 characters, at least 1 letter, at least 1 digit
 */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 24 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password)
  );
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}