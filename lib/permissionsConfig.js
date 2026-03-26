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
  'cases',       // engagement cases / ticketing + outages
]

/** All possible actions within a module. */
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'admin']

// ─── Role Defaults (Layer 1 base) ─────────────────────────────────────────────

export const ROLE_DEFAULTS = {
  CCO_ADMIN: {
    dashboard:  { view: true },
    accounts:   { view: true, create: true, edit: true, delete: true, admin: true },
    pipeline:   { view: true, create: true, edit: true, delete: true, admin: true },
    onboarding: { view: true, create: true, edit: true, delete: true, admin: true },
    invoicing:  { view: true, create: true, edit: true, delete: true, admin: true },
    analytics:  { view: true, admin: true },
    settings:   { view: true, create: true, edit: true, delete: true, admin: true },
    cases:      { view: true, create: true, edit: true, delete: true, admin: true },
  },
  REVENUE_MANAGER: {
    dashboard:  { view: true },
    accounts:   { view: true, create: true, edit: true },
    pipeline:   { view: true, create: true, edit: true },
    onboarding: { view: true, create: true, edit: true },
    invoicing:  { view: true, create: true, edit: true },
    analytics:  { view: true },
    settings:   { view: true, edit: true },
    cases:      { view: true, create: true, edit: true, delete: true },
  },
  CUSTOMER_SUCCESS: {
    dashboard:  { view: true },
    accounts:   { view: true, edit: true },
    pipeline:   { view: true },
    onboarding: { view: true, create: true, edit: true },
    invoicing:  { view: true },
    analytics:  { view: true },
    settings:   {},
    cases:      { view: true, create: true, edit: true },
  },
  READ_ONLY: {
    dashboard:  { view: true },
    accounts:   { view: true },
    pipeline:   { view: true },
    onboarding: { view: true },
    invoicing:  { view: true },
    analytics:  { view: true },
    settings:   {},
    cases:      { view: true },
  },
}

// ─── Permission Resolution (3 layers) ────────────────────────────────────────
//
// Layer 1: ROLE_DEFAULTS[role]           — system role base
// Layer 2: customRolePermissions (if set) — replaces layer 1 as the base
// Layer 3: overrides (User.permissions)  — per-user fine-tuning on top
//
// CCO_ADMIN is exempt from custom roles — always uses ROLE_DEFAULTS.CCO_ADMIN.

/**
 * Merge base permissions with per-user overrides → effective permission map.
 * @param {string} role - system role key
 * @param {object} overrides - User.permissions JSON (layer 3)
 * @param {object|null} customRolePermissions - CustomRole.permissions (layer 2), null = not set
 */
export function resolvePermissions(role, overrides = {}, customRolePermissions = null) {
  // Layer 2 replaces layer 1 when a custom role is set (CCO_ADMIN is always exempt)
  const base = (customRolePermissions !== null && role !== 'CCO_ADMIN')
    ? customRolePermissions
    : (ROLE_DEFAULTS[role] || {})

  const result = {}
  for (const mod of MODULES) {
    result[mod] = {
      ...(base[mod] || {}),
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
  const customRolePermissions = session.user.customRolePermissions ?? null
  const resolved = resolvePermissions(session.user.role, overrides, customRolePermissions)
  return resolved[module]?.[action] === true
}
