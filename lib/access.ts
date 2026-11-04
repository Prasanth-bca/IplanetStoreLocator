/**
 * Which pages and APIs each role may use. Pure logic, shared by the middleware (which decides from
 * the signed session) and by tests. Admins can use everything; sales users get an explicit
 * allowlist and everything else is denied by default.
 */

export type Role = 'ADMIN' | 'SALES' | 'SERVICE' | 'STORE';
export const ROLES: readonly Role[] = ['ADMIN', 'SALES', 'SERVICE', 'STORE'];
/** Roles an admin may pick when creating or editing a person on the Users page. A STORE login is tied to one store, so it is created from the Store accounts page instead. */
export const ASSIGNABLE_ROLES: readonly Role[] = ['ADMIN', 'SALES', 'SERVICE'];

export function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'SALES' || value === 'SERVICE' || value === 'STORE';
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', SALES: 'CEC user', SERVICE: 'Service user', STORE: 'Store user' };

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
  { path: '/billing-notes' },
  { path: '/account' },
  // APIs: identity and sign-out
  { path: '/api/me' },
  { path: '/api/me/password', methods: ['POST'] },
  // The live-monitor heartbeat: without this a Sales user's session never updates and drops off the Live Monitor.
  { path: '/api/me/heartbeat', methods: ['POST'] },
  { path: '/api/logout', methods: ['POST'] },
  // APIs: store finder, stock viewer and product viewer
  { path: '/api/stores/search' },
  { path: '/api/stores/list' },
  { path: '/api/stores/stock/availability', methods: ['POST'] },
  { path: /^\/api\/stores\/[^/]+\/stock$/ },
  { path: '/api/products' },
  { path: '/api/offers' },
  // APIs: the assistant (chat window)
  { path: '/api/chat', methods: ['POST'] },
  { path: '/api/chat/status' },
  // APIs: billing notes (a rep sees and edits only their own; the routes enforce that; deleting is admin only)
  { path: '/api/billing-notes', methods: ['GET', 'POST'] },
  { path: '/api/billing-notes/export' },
  { path: /^\/api\/billing-notes\/[^/]+$/, methods: ['PATCH'] },
  // APIs: passing a lead and reading their own history
  { path: '/api/leads', methods: ['POST'] },
  { path: '/api/my/leads' },
  // Sharing a lead directly with a store, and following what happened to the ones they shared (the routes show only their own)
  { path: '/share-lead' },
  { path: '/api/store-leads', methods: ['GET', 'POST'] },
  { path: '/api/store-leads/stores' },
  // Market Price & Offers: the routes also check that the admin has switched it on for the role
  { path: '/market' },
  { path: '/api/market/access' },
  { path: '/api/market/search' },
  { path: '/api/market/suggest' },
  { path: '/api/market/refresh', methods: ['POST'] },
];

/**
 * A service user can use everything a sales user can except passing or sharing leads (and the lead histories
 * that go with them).
 */
const LEAD_ONLY_PATHS = new Set(['/my-leads', '/share-lead', '/api/leads', '/api/my/leads', '/api/store-leads', '/api/store-leads/stores']);
const SERVICE_ALLOWED: Rule[] = SALES_ALLOWED.filter(r => !(typeof r.path === 'string' && LEAD_ONLY_PATHS.has(r.path)));

/**
 * A store login sees only its own store's received leads. Everything else is denied, and the routes
 * behind these paths check again that the lead belongs to the signed-in store.
 */
const STORE_ALLOWED: Rule[] = [
  // Pages
  { path: '/' },
  { path: '/store-leads' },
  { path: '/account' },
  // APIs: identity and sign-out
  { path: '/api/me' },
  { path: '/api/me/password', methods: ['POST'] },
  { path: '/api/me/heartbeat', methods: ['POST'] },
  { path: '/api/logout', methods: ['POST'] },
  // APIs: received leads, follow-up updates and alerts
  { path: '/api/store/leads' },
  { path: /^\/api\/store\/leads\/[^/]+$/, methods: ['GET', 'PATCH'] },
  { path: '/api/lead-alerts' },
  { path: '/api/lead-alerts/read', methods: ['POST'] },
  // Market Price & Offers: the routes also check that the admin has switched it on for the role
  { path: '/market' },
  { path: '/api/market/access' },
  { path: '/api/market/search' },
  { path: '/api/market/suggest' },
  { path: '/api/market/refresh', methods: ['POST'] },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

export function canAccess(role: Role, pathname: string, method = 'GET'): boolean {
  if (role === 'ADMIN') return true;
  const path = norm(pathname);
  const verb = method.toUpperCase();
  const rules = role === 'STORE' ? STORE_ALLOWED : role === 'SERVICE' ? SERVICE_ALLOWED : SALES_ALLOWED;
  return rules.some(rule => {
    const matches = typeof rule.path === 'string' ? rule.path === path : rule.path.test(path);
    if (!matches) return false;
    const allowed = rule.methods ?? ['GET', 'HEAD'];
    return allowed.includes(verb);
  });
}

/**
 * Every page the app serves. Used so sign-in only ever sends someone to a real page, never to a
 * remembered address that doesn't exist (e.g. /dashboard from another project on localhost:3000).
 * Keep this in step with the page.tsx files under app/ when a page is added or removed.
 */
export const APP_PAGES: readonly string[] = [
  '/',
  '/locator',
  '/stock',
  '/products',
  '/my-leads',
  '/billing-notes',
  '/share-lead',
  '/store-leads',
  '/market',
  '/account',
  '/admin',
  '/admin/stock',
  '/admin/products',
  '/admin/leads',
  '/admin/users',
  '/admin/sessions',
  '/admin/offers',
  '/admin/chatbot',
  '/admin/store-leads',
  '/admin/store-accounts',
  '/admin/market',
];

/** True if the path (ignoring any ?query or #hash) is one of the app's pages. */
export function isAppPage(pathname: string): boolean {
  return APP_PAGES.includes(norm(pathname.split('#')[0].split('?')[0]));
}
