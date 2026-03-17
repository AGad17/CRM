/**
 * Client-safe permission constants and helpers.
 * This file contains NO server-only imports (no next/server, no next-auth).
 * Import from here in 'use client' components.
 * Server-side guards (requirePermission, requireAuth) are in lib/roleGuard.js.
 */

// ─── Modules & Actions ────────────────────────────────────────────────────────

/** All named modules in the CRM. */
export const MODULES = [
  'dashboard',   // KPI dashboard
  'accounts',    // accounts list, detail, contracts, notes, churn
  'pipeline',    // leads kanban + expired accounts tab
  'onboarding',  // ops/onboarding tracker
  'invoicing',   // deals, invoices, AR report
  'analytics',   // analytics pages
  'settings',    // countries, pricing, team management
]

/** All possible actions within a module. */
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'admin']

// ─── Role Defaults ────────────────────────────────────────────────────────────

export const ROLE_DEFAULTS = {
  CCO_ADMIN: {
    dashboard:  { view: true },
    accounts:   { view: true, create: true, edit: true, delete: true, admin: true },
    pipeline:   { view: true, create: true, edit: true, delete: true, admin: true },
    onboarding: { view: true, create: true, edit: true, delete: true, admin: true },
    invoicing:  { view: true, create: true, edit: true, delete: true, admin: true },
    analytics:  { view: true, admin: true },
    settings:   { view: true, create: true, edit: true, delete: true, admin: true },
  },
  REVENUE_MANAGER: {
    dashboard:  { view: true },
    accounts:   { view: true, create: true, edit: true },
    pipeline:   { view: true, create: true, edit: true },
    onboarding: { view: true, create: true, edit: true },
    invoicing:  { view: true, create: true, edit: true },
    analytics:  { view: true },
    settings:   { view: true, edit: true },
  },
  CUSTOMER_SUCCESS: {
    dashboard:  { view: true },
    accounts:   { view: true, edit: true },
    pipeline:   { view: true },
    onboarding: { view: true, create: true, edit: true },
    invoicing:  { view: true },
    analytics:  { view: true },
    settings:   {},
  },
  READ_ONLY: {
    dashboard:  { view: true },
    accounts:   { view: true },
    pipeline:   { view: true },
    onboarding: { view: true },
    invoicing:  { view: true },
    analytics:  { view: true },
    settings:   {},
  },
}

// ─── Permission Resolution ────────────────────────────────────────────────────

/**
 * Merge role defaults with per-user overrides → effective permission map.
 * `overrides` is the user.permissions JSON (can be {}).
 */
export function resolvePermissions(role, overrides = {}) {
  const defaults = ROLE_DEFAULTS[role] || {}
  const result = {}
  for (const mod of MODULES) {
    result[mod] = {
      ...(defaults[mod] || {}),
      ...(overrides[mod] || {}),
    }
  }
  return result
}

/**
 * Client-safe check — call with the session object from useSession().
 * Returns true if the user has the given module+action permission.
 */
export function hasPermission(session, module, action) {
  if (!session?.user) return false
  const overrides = session.user.permissions || {}
  const resolved = resolvePermissions(session.user.role, overrides)
  return resolved[module]?.[action] === true
}
