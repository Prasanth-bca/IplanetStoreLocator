/**
 * Which pages and APIs each role may use. Pure logic, shared by the middleware (which decides from
 * the signed session) and by tests. Admins can use everything; sales users get an explicit
 * allowlist and everything else is denied by default.
 */

export type Role = 'ADMIN' | 'SALES';
export const ROLES: readonly Role[] = ['ADMIN', 'SALES'];

export function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'SALES';
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', SALES: 'Sales user' };

interface Rule {
  /** Exact path, or a RegExp tested against the whole path. */
  path: string | RegExp;
  /** HTTP methods allowed; omit for GET/HEAD only. */
  methods?: string[];
}

const SALES_ALLOWED: Rule[] = [
  // Pages
  { path: '/' },
  { path: '/locator' },
  { path: '/stock' },
  { path: '/products' },
  { path: '/my-leads' },
  { path: '/account' },
  // APIs: identity and sign-out
  { path: '/api/me' },
  { path: '/api/me/password', methods: ['POST'] },
  { path: '/api/logout', methods: ['POST'] },
  // APIs: store finder, stock viewer and product viewer
  { path: '/api/stores/search' },
  { path: '/api/stores/list' },
  { path: '/api/stores/stock/availability', methods: ['POST'] },
  { path: /^\/api\/stores\/[^/]+\/stock$/ },
  { path: '/api/products' },
  // APIs: passing a lead and reading their own history
  { path: '/api/leads', methods: ['POST'] },
  { path: '/api/my/leads' },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

export function canAccess(role: Role, pathname: string, method = 'GET'): boolean {
  if (role === 'ADMIN') return true;
  const path = norm(pathname);
  const verb = method.toUpperCase();
  return SALES_ALLOWED.some(rule => {
    const matches = typeof rule.path === 'string' ? rule.path === path : rule.path.test(path);
    if (!matches) return false;
    const allowed = rule.methods ?? ['GET', 'HEAD'];
    return allowed.includes(verb);
  });
}
