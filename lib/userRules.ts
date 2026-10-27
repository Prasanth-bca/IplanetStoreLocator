/** Validation for user accounts. Pure, so the API routes and the tests share it. */

import { isRole, Role } from '@/lib/access';

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!u) return 'Enter a username.';
  if (!USERNAME_PATTERN.test(u)) return 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (/^\s+$/.test(password)) return 'Password can’t be only spaces.';
  return null;
}

export function validateName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2) return 'Enter the person’s name.';
  if (name.length > 80) return 'Keep the name under 80 characters.';
  return null;
}

export function parseRole(value: unknown): Role | null {
  return isRole(value) ? value : null;
}

/**
 * Would changing this admin leave the system without an active admin?
 * `otherActiveAdmins` is the number of active admins besides the person being changed.
 */
export function wouldRemoveLastAdmin(
  target: { role: Role; active: boolean },
  change: { role?: Role; active?: boolean },
  otherActiveAdmins: number
): boolean {
  const isActiveAdminNow = target.role === 'ADMIN' && target.active;
  const staysActiveAdmin = (change.role ?? target.role) === 'ADMIN' && (change.active ?? target.active);
  return isActiveAdminNow && !staysActiveAdmin && otherActiveAdmins < 1;
}
