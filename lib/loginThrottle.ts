/**
 * Slows down password guessing: after MAX_FAILURES wrong attempts for the same sign-in name from
 * the same address, further attempts are refused for WINDOW_MS. Held in memory, so on serverless
 * hosting each running instance counts separately: a brake on guessing, not a hard limit.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const MAX_TRACKED = 5000;

const failures = new Map<string, { count: number; firstAt: number }>();

const keyOf = (ip: string, username: string) => `${ip}|${username}`;

/** Seconds the caller must wait, or 0 if they may try. */
export function retryAfterSeconds(ip: string, username: string): number {
  const entry = failures.get(keyOf(ip, username));
  if (!entry) return 0;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    failures.delete(keyOf(ip, username));
    return 0;
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.firstAt + WINDOW_MS - Date.now()) / 1000) : 0;
}

export function recordFailure(ip: string, username: string) {
  const key = keyOf(ip, username);
  const entry = failures.get(key);
  if (entry && Date.now() - entry.firstAt <= WINDOW_MS) {
    entry.count++;
    return;
  }
  if (failures.size >= MAX_TRACKED) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  failures.set(key, { count: 1, firstAt: Date.now() });
}

export function clearFailures(ip: string, username: string) {
  failures.delete(keyOf(ip, username));
}
