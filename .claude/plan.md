# Plan: Unified Products & Pricing

## Goal
Consolidate the two separate pricing systems into one "Products & Pricing" admin section:
- `/products` page — generic product catalog (Plan/AddOn) with per-country price history
- `/invoicing/pricing` — specific pricing matrices (branch, accounting, flat modules, VAT)

These become ONE page: `/products` renamed to "Products & Pricing" with two tabs.

## What's NOT changing
- All API routes stay the same (no schema changes)
- Deal calculator continues reading from BranchPricing / AccountingPricing / FlatModulePricing
- All invoicing functionality untouched
- Contracts system untouched (ContractItem.productId already exists)

## Changes

### 1. `/app/(app)/products/page.js` — Tabbed Products & Pricing page
Two tabs:
- **"Catalog"** tab — existing product table (Plan/AddOn), create/edit products, per-country price history
- **"Pricing"** tab — the full content of the current `/invoicing/pricing` page moved here (branch matrix, accounting, flat modules, VAT rates)

### 2. `/components/layout/Sidebar.js`
- Rename `{ href: '/products', label: 'Products', icon: '📦' }` → `label: 'Products & Pricing'`
- Remove `{ href: '/invoicing/pricing', label: 'Pricing Config' }` from Invoicing children
- The Invoicing section keeps: Deal Calculator, Sales Log, Invoices, AR Report

### 3. `/app/(app)/invoicing/pricing/page.js` — Redirect
Replace the pricing page content with a redirect to `/products?tab=pricing`
so existing bookmarks/links don't 404.

## Result
- One place for all pricing configuration
- Invoicing section is cleaned up (pricing config moved out of it — it's not really an invoicing-specific concept, it's a catalog concept)
- No broken APIs or functionality
