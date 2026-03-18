# ShopBrain CRM — User Guide

> **Version:** 1.0 · **Updated:** March 2026
> This guide lives in the repository (`docs/USER_GUIDE.md`) and should be updated whenever a module changes.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Roles & Permissions](#3-roles--permissions)
4. [Dashboard](#4-dashboard)
5. [Sales Pipeline](#5-sales-pipeline)
6. [Accounts](#6-accounts)
7. [Operations (Customer Journey)](#7-operations-customer-journey)
8. [Invoicing](#8-invoicing)
9. [Analytics](#9-analytics)
10. [Settings](#10-settings)
11. [How Numbers Are Calculated](#11-how-numbers-are-calculated)
12. [Common Workflows](#12-common-workflows)

---

## 1. Overview

ShopBrain CRM is the internal revenue intelligence platform covering the entire customer lifecycle:

```
Lead → Qualified → Closed Won → Onboarding → Account Management → Renewal / Churn
```

**Six core modules:**

| Module | Purpose |
|--------|---------|
| Dashboard | Executive KPI snapshot |
| Sales Pipeline | Lead tracking and deal closing |
| Accounts | Customer master database |
| Operations | Customer journey and onboarding tracker |
| Invoicing | Deal confirmation, invoices, AR |
| Analytics | Revenue trends and performance reporting |

---

## 2. Getting Started

### Logging In

1. Go to the CRM URL and click **Sign In**
2. Enter your company email and password
3. You will land on the **Dashboard**

> First-time users: ask a CCO_ADMIN to create your account from **Settings → Team → Invite User**. You will receive credentials from your admin.

### Navigation

The left sidebar (or top nav) gives access to all six modules. Your visible options depend on your role — some modules or actions may be hidden if you don't have access.

### Key Conventions

- **Bold labels** = required fields
- **Gray text** = read-only / calculated values
- **Red badges** = overdue, at-risk, or urgent
- **Amber badges** = warning, needs attention
- **Green badges** = healthy, active, on track

---

## 3. Roles & Permissions

### System Roles

Every user has one of four system roles:

| Role | Who It's For | Key Access |
|------|-------------|------------|
| **CCO_ADMIN** | Management / Super Admin | Full access to everything, including Settings |
| **REVENUE_MANAGER** | Sales / Revenue leads | Full access except delete & admin actions |
| **CUSTOMER_SUCCESS** | CS team members | Onboarding full access; read-only for Pipeline & Invoicing |
| **READ_ONLY** | Observers / Guests | View-only across all modules |

### Custom Roles

Admins can create **custom roles** — named permission templates with any combination of module access. A custom role replaces the system role defaults for that user (except CCO_ADMIN, which always has full access).

**Examples:**
- *"Sales Rep"* — Pipeline view + create, Accounts view only
- *"Finance Viewer"* — Invoicing view only, no other modules

### Permission Layers

Permissions are resolved in 3 layers (highest layer wins):

```
Layer 1: System role defaults         (e.g., REVENUE_MANAGER)
Layer 2: Custom role permissions      (replaces Layer 1 if assigned)
Layer 3: Per-user overrides           (fine-tune on top of base)
```

CCO_ADMIN is always exempt — always uses system defaults regardless of custom role.

### Module Actions

Each module has up to 5 actions:

| Action | Meaning |
|--------|---------|
| `view` | See the module and its data |
| `create` | Add new records |
| `edit` | Modify existing records |
| `delete` | Remove records |
| `admin` | Access admin-only features (e.g., pricing management) |

---

## 4. Dashboard

**Who uses it:** Everyone
**Required permission:** `dashboard.view`

The Dashboard gives you a real-time snapshot of the business. Use the **Lead Source** and **Country** filters at the top to narrow all KPIs to a specific segment.

---

### 4.1 Account KPIs

| KPI | What It Shows |
|-----|--------------|
| **Total Accounts** | All accounts ever created |
| **Active Accounts** | Accounts with at least one valid (non-cancelled) contract |
| **Expired Accounts** | Contracts reached end date without cancellation (natural lapse) |
| **Churned Accounts** | Contracts explicitly cancelled by the customer |
| **Overall Churn Rate** | `Churned ÷ Total Accounts × 100` |
| **Accumulative Churn** | Expired + Churned combined count |
| **Accumulative Churn %** | `(Expired + Churned) ÷ Total × 100` |

> **Expired vs. Churned:** Expired = contract ended naturally (opportunity to renew). Churned = customer explicitly cancelled (harder to recover).

---

### 4.2 Revenue KPIs

| KPI | Definition |
|-----|-----------|
| **Total MRR** | Sum of monthly value across all active contracts |
| **Total ARR** | `Total MRR × 12` |
| **Total ACV** | Sum of annualized contract values |
| **Total Contract Value** | Sum of all contract values (active + expired) |
| **Active Contract Value** | Contract value of non-cancelled contracts only |
| **ARPA** | `Total MRR ÷ Active Accounts` |
| **Avg ACV** | `Total ACV ÷ Active Contracts` |
| **Avg MRR / Contract** | `Total MRR ÷ Active Contract Count` |

---

### 4.3 MRR Composition Chart

A stacked bar chart showing the last 3 months:

| Component | Color | What It Means |
|-----------|-------|---------------|
| New MRR | Blue | Revenue from brand-new accounts |
| Expansion MRR | Green | Revenue from upsells to existing accounts |
| Renewal MRR | Light purple | Revenue from contract renewals |
| Churned MRR | Red outline | Revenue lost from churned accounts |

---

### 4.4 At-Risk Accounts

A red warning strip appears if any accounts have a **health score below 40**. Click an account badge to navigate directly to its tracker.

---

### 4.5 Operations KPIs

| KPI | What It Shows |
|-----|--------------|
| **Open Tasks** | All incomplete onboarding tasks across all accounts |
| **Overdue Tasks** | Tasks where due date has passed and not completed |

---

### 4.6 Efficiency Ratios

| KPI | Definition |
|-----|-----------|
| **NRR (Last Month)** | Net Revenue Retention over the last 30 days |
| **NRR (Last Quarter)** | Net Revenue Retention over the last 90 days |
| **MRR per Branch** | `Total MRR ÷ Total Active Branches` |
| **Avg Contract Duration** | Average contract length in months |
| **Total / Active Contracts** | Raw contract counts |

---

### 4.7 Footprint KPIs

| KPI | What It Shows |
|-----|--------------|
| **Countries Served** | Number of active countries with accounts |
| **Total Brands** | Total brand entities across all active accounts |
| **Total Branches** | Total branch locations across active accounts |

---

### 4.8 Recent Performance Table

A 3-month historical table with 11 metrics and month-over-month delta badges:

- New MRR Signed / Expansion MRR / Renewal MRR / Total MRR Signed
- Churned MRR / Net New MRR
- New Contracts / Churned Contracts / Contract Value
- NRR / GRR (Gross Revenue Retention)

Delta badges show the % change vs. the previous month — green for positive, red for negative.

---

## 5. Sales Pipeline

**Who uses it:** Revenue Manager, CCO_ADMIN (and Customer Success for read-only)
**Required permission:** `pipeline.view`

The Pipeline tracks all sales opportunities from first contact to deal close.

---

### 5.1 Pipeline Stages

The pipeline has **4 active stages** (left to right in the kanban):

| Stage | Color | Meaning |
|-------|-------|---------|
| **Lead** | Slate | Initial contact, not yet qualified |
| **Qualified** | Blue | Needs assessed, deal in progress |
| **Closed Won** | Emerald | Deal signed — account created |
| **Closed Lost** | Red | Deal did not close |

> **Important:** Expired and Churned lifecycle is tracked in the **Operations** module, not the Pipeline. The Pipeline terminates at Closed Won or Closed Lost.

---

### 5.2 Opportunity Types

When creating a lead, select the opportunity type:

| Type | Icon | When to Use |
|------|------|-------------|
| **New** | ✨ | Brand-new customer, no prior account |
| **Expansion** | 📈 | Existing account adding branches or modules |
| **Renewal** | 🔄 | Existing account renewing their contract |

For **Expansion** and **Renewal**, you must link the lead to an existing **Account**.

---

### 5.3 Lead Source Channels

| Channel | Description |
|---------|-------------|
| Foodics | Referred through Foodics POS integration |
| Employee Referral | Referred by a ShopBrain team member |
| Customer Referral | Referred by an existing customer |
| Partner Referral | Referred by a business partner |
| Website | Inbound from the website |
| Ambassador Referral | Referred by a brand ambassador |
| Direct Sales | Outbound, cold outreach |
| Sonic | Referred through Sonic POS integration |

---

### 5.4 Creating a Lead

1. Click **+ New Lead**
2. Fill in the required fields:
   - **Company Name** (required)
   - **Lead Source / Channel** (required)
   - **Owner** — assigned salesperson (required)
   - Opportunity Type (New / Expansion / Renewal)
   - For Expansion/Renewal: link to existing **Account**
3. Optional but recommended: contact info, estimated value, # branches, package interest, expected close date
4. Click **Save**

---

### 5.5 Moving a Lead Through Stages

**From the Kanban:**
- Drag the card to the target column, OR
- Click the card → use the stage action button

**Allowed transitions:**

| From | Allowed To |
|------|-----------|
| Lead | Qualified, Closed Lost |
| Qualified | Closed Won, Closed Lost, Lead (back) |
| Closed Won | — (terminal) |
| Closed Lost | — (terminal) |

When moving to **Closed Lost**, you can optionally record a loss reason.

When moving to **Closed Won**, you will be prompted to create a deal in the Invoicing module and link/create an account.

---

### 5.6 Risk Indicators

Leads are flagged as **at-risk** (amber/red) if they have not been updated in 7+ days. This appears as a badge on the kanban card and in the table view.

---

### 5.7 Expired Accounts Tab

A separate tab (not a pipeline stage) shows accounts whose contracts have lapsed and are candidates for renewal. This is informational — actions on these accounts happen in the **Operations** or **Accounts** modules.

---

### 5.8 Switching Views

Toggle between **Kanban** (default) and **Table** view using the icon buttons at the top right. The table view is better for bulk review.

---

## 6. Accounts

**Who uses it:** Everyone (read); Revenue Manager + CCO_ADMIN (write)
**Required permission:** `accounts.view`

Accounts is the master customer database. Every active or past customer has a record here.

---

### 6.1 Account Statuses

| Status | Meaning |
|--------|---------|
| **Active** | At least one valid, non-cancelled contract |
| **Expired** | All contracts past end date — no cancellation (natural lapse) |
| **Churned** | Account has at least one cancelled contract |

---

### 6.2 Account List

The accounts list shows:
- Account Code, Name, Country
- Lead Source
- # Brands / # Branches
- Total MRR (active contracts)
- Account Manager
- Current Journey Stage (from Operations)
- Status with color badge
- Churn Date (if churned)

**Filters:** Country, Lead Source, search by name.
**Export:** Download as CSV using the export button.

---

### 6.3 Account Detail

Click any account to open its detail view:

- **Contract History** — all contracts, their start/end dates, value, and cancellation status
- **Health Score** — current health score with breakdown (tasks, CSAT, NPS)
- **Onboarding Tracker** — current journey phase and progress
- **Notes** — timestamped notes from the team
- **Activity Log** — system-recorded events (stage changes, phase changes, etc.)

---

### 6.4 Editing an Account

Click **Edit** on the account detail or from the list actions:
- Update name, country, lead source
- Change assigned account manager
- Add notes

---

## 7. Operations (Customer Journey)

**Who uses it:** Customer Success (primary), Revenue Manager, CCO_ADMIN
**Required permission:** `onboarding.view`

The Operations module tracks every customer through a structured **7-phase journey** from deal close to ongoing account management (or churn).

---

### 7.1 The 7 Phases

#### Phase 1 — Deal Closure *(~3 days)*
**Owner:** Sales / Account Management
The deal has been won. Core tasks: send contract, share SOP document, complete internal handover, send kickoff email to client.

#### Phase 2 — Onboarding *(~23 days)*
**Owner:** Onboarding Team
Configure the system for the client. Tasks include scheduling a welcome call, collecting menu/inventory data, configuring Foodics modules, running internal QA, and presenting the final setup.

#### Phase 3 — Training *(~14 days)*
**Owner:** Onboarding Team
Train the client on all modules (Inventory, Recipes, Accounting, Production, Forecasting, Reports), run assessments, and complete a go-live readiness checklist.

#### Phase 4 — Incubation *(~14 days)*
**Owner:** Onboarding Team
Support the client's first two weeks live. Daily support logs, mid-incubation review, targeted retraining if needed, CSAT capture, and closure report.

#### Phase 5 — Account Management *(Ongoing)*
**Owner:** Customer Success Team
Ongoing relationship management. Monthly check-ins, quarterly business reviews, upsell/cross-sell identification. Recurring tasks auto-generate each month/quarter.

#### Phase 6 — Expired *(Auto-triggered)*
**Owner:** Customer Success Team
Contracts lapsed naturally without cancellation. The account is in a renewal window. CS team pursues re-engagement. Tracker shows days until renewal deadline.

#### Phase 7 — Churned *(Terminal)*
**Trigger:** Account explicitly cancelled contracts
No further lifecycle actions. Account removed from active reporting.

---

### 7.2 Auto-Sync Logic

The Operations page automatically runs `syncExpiredTrackers()` on every load:

- Evaluates every account's contract state
- If **all contracts are past end date** and **none were cancelled** → moves tracker to **Expired**
- If **any contract was cancelled** → tracker stays in or moves to **Churned**
- This is the **source of truth** — the contract data always wins

> You can also click **Sync All Accounts** manually to ensure all accounts have trackers and are in the correct phase.

---

### 7.3 Kanban View

The main view is a **7-column kanban** (one column per phase). Each column shows:
- Phase name and responsible team
- Count of accounts in that phase
- Overdue task count (red badge if any)

**Cards show:**
- Account name + country
- "X days in this phase" badge (green < 7 days, amber 7–14 days, red > 14 days)
- Overdue task count
- Package and POS system tags
- Task progress bar (completed / total)
- Phase start date

Click any card to open the **Tracker Detail** page.

---

### 7.4 List View

Toggle to List view for a tabular overview with:
- Phase filter buttons across the top
- Columns: Account, Phase, Team, Progress, Started, Days in Phase, Overdue, Country

---

### 7.5 Tracker Detail Page

Click any account card to open the full tracker detail:

1. **Account & Deal Info** — linked account, contract summary
2. **Current Phase & Progress** — visual phase bar, % tasks completed
3. **Task Checklist** — grouped by phase, toggle completion
   - Completed tasks show timestamp
   - Overdue tasks highlighted in red
   - Recurring tasks auto-generate a new instance when completed
4. **Staff Assignments** — assign Onboarding Specialist, Training Specialist, Account Manager
5. **CSAT History** — one record per phase transition (auto-created), 1–5 scale
6. **NPS History** — quarterly records for Incubation + Account Management phases, 0–10 scale
7. **Notes Timeline** — add team notes with author name captured automatically

---

### 7.6 Moving to the Next Phase

From the tracker detail:
1. Click **Advance to [Next Phase]**
2. Confirm in the modal
3. A **CSAT record is automatically created** for this transition
4. All tasks for the new phase are auto-seeded

To **jump to any phase** (not just the next): click **Set Phase** and select the target phase.

---

### 7.7 Health Score

Each account receives an automated **health score (0–100)**:

| Score | Label | Color |
|-------|-------|-------|
| 70–100 | Healthy | Green |
| 40–69 | Watch | Amber |
| 0–39 | At Risk | Red |

Score factors:
- Task completion % in current phase
- Average CSAT score
- Average NPS score
- Overdue task count (deducted)

At-risk accounts (< 40) appear in the **Dashboard warning strip**.

---

## 8. Invoicing

**Who uses it:** Revenue Manager (primary), CCO_ADMIN
**Required permission:** `invoicing.view`

The Invoicing module manages deal confirmation, invoice generation, and accounts receivable tracking.

---

### 8.1 Deal Calculator

**Path:** Invoicing → Deal Calculator

Use the Deal Calculator when a deal is ready to be confirmed (Closed Won in Pipeline).

**Inputs:**
- Account name / brand names
- Deal Type: New, Renewal, Upsell, Expansion
- POS System: Foodics, Geidea, Sonic
- Country and sales channel
- Package: Essential, Operations, Enterprise
- Payment Type: Annual, Quarterly, Special
- Number of branches (normal branches, central kitchens, warehouses)
- Add-ons: Accounting, Butchering, AI Agent seats
- Discount %

**Calculated Outputs:**

| Field | Description |
|-------|-------------|
| Base MRR | Pricing based on package × branch count |
| Add-on MRR | Per-add-on charges |
| Total MRR (excl. VAT) | Base + Add-ons − Discount |
| VAT Amount | `Total MRR × Country VAT Rate` |
| Total MRR (incl. VAT) | Total MRR + VAT |
| Contract Months | Duration based on payment type |
| Contract Value | `Total MRR (excl. VAT) × Contract Months` |

**Confirm Deal** creates:
- A **Deal** record with snapshot values (immutable once confirmed)
- A **Contract** linked to the account
- One or more **Invoices** (based on payment type)
- A new **Account** (if Deal Type = New)

---

### 8.2 Sales Log (Deals)

**Path:** Invoicing → Sales Log

A full log of all confirmed deals.

**Columns:** Deal ID, Account, Brands, Deal Type, Country, Package, Total MRR, Contract Value, Date, Status

**Filters:** Country, Deal Type, POS System

**Actions:**
- Edit deal (limited edits after confirmation — discount, add-on counts, account linkage)
- View invoices for this deal
- Create additional invoice (for special/supplemental billing)

---

### 8.3 Invoices

**Path:** Invoicing → Invoices

Four tabs for different invoice views:

#### Tab 1: Foodics AR (Active Receivables)
Open Foodics invoices pending collection.

| Column | Description |
|--------|-------------|
| Invoice # | ShopBrain format: `SB-{YEAR}Q{QUARTER}-{random}` |
| Foodics Invoice # | The Foodics-side invoice ID (enter manually) |
| Eligible Date | Invoice date + 38 days |
| Days Until Eligible | Countdown to eligible collection date |
| Amount | Invoice amount incl. VAT |
| Status | Pending → Eligible → Collected |
| Collection Date | Date payment was received |

**Workflow:**
1. Invoice is created → Status = **Pending**
2. After 38 days → Status can be changed to **Eligible**
3. Once Foodics pays → Set Status = **Collected** and enter collection date

#### Tab 2: Foodics History
All collected Foodics invoices. Shows collection date and total cycle days (invoice date → collection date).

#### Tab 3: Direct AR
Non-Foodics invoices (Geidea, Sonic, Direct).

Same status workflow: Pending → Collected.

#### Tab 4: Full History
All invoices (Foodics + Direct) in one table. Full transaction log.

---

### 8.4 AR Report

**Path:** Invoicing → AR Report

Summary metrics:

| Metric | Description |
|--------|-------------|
| Total AR | Sum of pending invoice values |
| Eligible Invoices | Count of invoices past their eligible date |
| Collected | Count of collected invoices this period |
| Avg Collection Cycle | Average days from invoice date to collection date |

Breakdown by country and by POS system. Aging buckets: 0–30 days, 30–60 days, 60–90 days, 90+ days.

---

### 8.5 Pricing

**Path:** Invoicing → Pricing
**Required:** `invoicing.admin`

Manage base pricing tables used by the Deal Calculator.

**Branch Pricing Table**
- Per Country, Channel, Package, Branch Type
- Annual price per unit
- Effective date range

**Add-On Pricing Table**
- Per Country, Channel, Add-On Module
- Modules: Accounting Main, Accounting Extra, Central Kitchen, Warehouse, Butchering, AI Agent
- Annual price

Changes here are effective immediately for all new deals calculated after the update.

---

## 9. Analytics

**Who uses it:** Everyone (read-only views)
**Required permission:** `analytics.view`

The Analytics module has 13+ specialized reporting views. Use the sidebar or dropdown to navigate between them.

---

### 9.1 MRR Waterfall

Shows how MRR changed from one month to the next:

```
Opening MRR
+ New MRR (new customers)
+ Expansion MRR (upsells)
+ Renewal MRR (renewals)
− Churned MRR (lost accounts)
= Closing MRR
```

Use this to understand the sources of MRR growth or decline.

---

### 9.2 MOM / QOQ / YOY

**Month-over-Month**, **Quarter-over-Quarter**, **Year-over-Year** trend views.

Each shows key metrics (MRR, new accounts, churn, NRR) compared to the prior period with delta badges.

---

### 9.3 Churn Analysis

- **Churn Rate %**: `Churned Accounts ÷ Total Accounts × 100`
- **Accumulative Churn**: Expired + Churned
- **By Country Breakdown**: Churn % per country
- **Churn Reasons**: If recorded at churn, shows distribution of reasons
- **Cohort Retention Curves**: Retention % by signup cohort

---

### 9.4 NRR Breakdown

**Net Revenue Retention (NRR)** = `(End MRR + Expansion − Churn) ÷ Start MRR × 100`

- **> 100%** = Growing even without new customers
- **= 100%** = Breaking even on existing base
- **< 100%** = Losing revenue on existing base

Shows GRR (Gross Retention) for comparison — GRR excludes expansion.

---

### 9.5 Account Health

- **Health Distribution**: How many accounts are Healthy / Watch / At Risk
- **Trend Over Time**: Average health score by month
- **At-Risk List**: All accounts below 40, sortable by score

Health score formula: combination of task completion %, average CSAT, average NPS, deductions for overdue tasks.

---

### 9.6 Lead Source Analysis

- **MRR by Source**: Which channels bring the most revenue
- **Win Rate by Source**: Lead → Closed Won conversion by channel
- **Avg Deal Size by Source**: Which channels have larger deals

Use this to allocate marketing and partnership investment.

---

### 9.7 CS Performance

- **Task Completion Rate**: % of tasks completed on time by CS rep
- **Overdue Count**: Open overdue tasks by team member
- **CSAT by Phase**: Average satisfaction at each phase transition
- **NPS Trends**: Quarterly NPS scores over time

---

### 9.8 Cohorts

Groups accounts by the month they were first created. Shows:
- How many accounts are retained each subsequent month
- Revenue per cohort over time
- Cohort expansion rates

---

### 9.9 Contracts

Contract lifecycle view:
- Active, Expired, Cancelled counts
- Renewals due in the next 90 days
- Average contract duration distribution
- Contract value by country

---

### 9.10 Products

Revenue breakdown by:
- **Package**: Essential vs. Operations vs. Enterprise MRR
- **Add-On Adoption**: % of accounts using each add-on
- **Revenue Mix**: % of total MRR by product category

---

### 9.11 Revenue Quality

- **Revenue Composition**: New vs. Expansion vs. Renewal each period
- **Stability Ratio**: Recurring vs. one-time revenue
- **LTV (Lifetime Value)**: Estimated lifetime value by segment

---

### 9.12 Segments

Slice and dice by:
- Country
- Package (Essential, Operations, Enterprise)
- Customer Size (# branches)

Each segment shows: count, total MRR, churn rate, growth rate.

---

### 9.13 Surveys

- **CSAT Records**: Auto-captured at every phase transition; 1–5 scale
- **NPS Records**: Captured quarterly for Incubation + Account Management; 0–10 scale
- **Trend Charts**: Score averages over time

---

### 9.14 Win / Loss

- **Win Rate**: By salesperson, by channel, by opportunity type
- **Loss Reasons**: Distribution of recorded loss reasons
- **Deal Velocity**: Average days from Lead to Closed Won

---

## 10. Settings

**Who uses it:** CCO_ADMIN (primary); some read access for Revenue Manager
**Required permission:** `settings.view`

---

### 10.1 Countries

Manage the list of active countries in the system.

| Field | Description |
|-------|-------------|
| Code | Short identifier (e.g., `UAE`) |
| Name | Full country name |
| Currency | Currency code (e.g., `AED`) |
| VAT Rate | Decimal rate (e.g., `0.05` = 5%) |
| Active | Whether this country appears in dropdowns |

VAT rates are applied automatically in the Deal Calculator when invoicing.

**Pre-configured countries:** Egypt, KSA, UAE, Bahrain, Jordan

---

### 10.2 Custom Roles

Create permission templates that can be assigned to multiple users.

**Creating a custom role:**
1. Click **+ Create Role**
2. Enter a name (required, must be unique) and optional description
3. Use the permission matrix to grant/revoke each module × action combination
4. Click **Save**

**Assigning a custom role:**
Go to the **Team** tab → find the user → select the custom role from the dropdown.

**Deleting a custom role:**
Not allowed if any users are currently assigned to it. Re-assign those users first.

**System Role Reference Card:**
An expandable table in the Roles tab shows the built-in role defaults for reference.

---

### 10.3 Team

Manage all users in the organization.

**Inviting a new user:**
1. Click **+ Invite User**
2. Enter email (required) and name (optional)
3. Select initial role (system role or custom role)
4. Click **Send Invite**
5. The user will receive credentials and can log in

**Managing user permissions:**
- **Custom Role dropdown** — assign a custom role (replaces system role as the base)
- **✏️ Permissions button** — open the per-user override modal
  - Green = role default (no override)
  - Indigo = manually granted
  - Red X = manually revoked
  - **Reset to Role Defaults** removes all overrides

**Deactivating a user:**
Click **Deactivate** next to the user. They will not be able to log in but their historical data is preserved.

---

## 11. How Numbers Are Calculated

### MRR

```
Contract MRR = (Annual Contract Value ÷ 12)
Total MRR    = Sum of all active contract MRRs
```

"Active" means: not cancelled (`cancellationDate IS NULL`) and end date is in the future.

---

### ARR

```
ARR = Total MRR × 12
```

---

### ACV (Annual Contract Value)

```
ACV = Contract Value ÷ Contract Months × 12
```

---

### NRR (Net Revenue Retention)

```
NRR = (MRR at end of period + Expansion MRR − Churned MRR)
      ÷ MRR at start of period × 100

NRR > 100% = Net expansion (good)
NRR = 100% = Flat (neutral)
NRR < 100% = Net loss (concerning)
```

---

### GRR (Gross Revenue Retention)

```
GRR = (MRR at end of period − Churned MRR)
      ÷ MRR at start of period × 100
```

GRR excludes expansion — shows pure retention of existing revenue.

---

### Churn Rate

```
Churn Rate % = Churned Accounts ÷ Total Accounts × 100
```

"Churned" = accounts with at least one cancelled contract (`cancellationDate IS NOT NULL`).

---

### Account Health Score (0–100)

Composite score from:
- **Task Completion %** in current phase (weighted positively)
- **Average CSAT score** (1–5, normalized)
- **Average NPS score** (0–10, normalized)
- **Overdue tasks** (deduct points per overdue task)

| Score Range | Label |
|------------|-------|
| 70–100 | Healthy |
| 40–69 | Watch |
| 0–39 | At Risk |

---

### Deal / Invoice Calculations

```
Base MRR       = Branch Pricing × Branch Count (by type)
Add-on MRR     = Add-on Pricing × Unit Count
Total MRR      = (Base + Add-on) × (1 − Discount %)
VAT Amount     = Total MRR × Country VAT Rate
Total incl VAT = Total MRR + VAT Amount

Contract Value = Total MRR (excl. VAT) × Contract Months
```

**Payment Types and Invoice Count:**
- **Annual** → 1 invoice for full contract value
- **Quarterly** → 4 invoices at 25% each
- **Special** → 1 invoice (custom terms)

**Foodics Eligible Collection Date:**
```
Eligible Date = Invoice Date + 38 days
```

---

### Days in Phase

```
Days in Phase = Today − Phase Start Date
```

Color coding:
- Green = < 7 days (fresh start)
- Amber = 7–14 days (monitor)
- Red = > 14 days (investigate)

---

## 12. Common Workflows

### Workflow 1: New Customer (End-to-End)

```
1. Create Lead (Pipeline → + New Lead)
   - Type: New, Channel: [source]

2. Qualify the Lead (move to Qualified stage)
   - Update contact info, estimated value

3. Close Won (move to Closed Won)
   - Go to Invoicing → Deal Calculator
   - Configure package, branches, add-ons
   - Confirm Deal → creates Account + Contract + Invoice

4. Onboarding Tracker auto-created (Deal Closure phase)
   - Assign Onboarding Specialist
   - Complete 4 Deal Closure tasks

5. Advance through phases: Onboarding → Training → Incubation → Account Management
   - Each phase: complete tasks, CSAT auto-captured on advance

6. Account Management (ongoing)
   - Monthly and quarterly recurring tasks auto-generated
   - NPS captured quarterly
```

---

### Workflow 2: Contract Renewal

```
1. Create Lead (Pipeline → + New Lead)
   - Type: Renewal
   - Link to existing Account

2. Qualify and close as normal

3. In Deal Calculator, set Deal Type = Renewal
   - New contract is created
   - Invoice(s) generated for renewal term

4. Account remains in Account Management phase in Operations
```

---

### Workflow 3: Account Expansion (Upsell)

```
1. Create Lead (Pipeline → + New Lead)
   - Type: Expansion
   - Link to existing Account

2. In Deal Calculator, set Deal Type = Expansion or Upsell
   - Additional contract line added to account
   - MRR increases → shows as Expansion MRR in waterfall
```

---

### Workflow 4: Invoicing a Foodics Deal

```
1. Deal confirmed → Invoice created (Status: Pending)

2. After 38 days, invoice becomes Eligible
   - Go to Invoicing → Invoices → Foodics AR
   - Change status to Eligible

3. When Foodics pays:
   - Enter Foodics Invoice # (from Foodics dashboard)
   - Change status to Collected
   - Enter Collection Date

4. Invoice moves to Foodics History
   - Collection cycle days are recorded automatically
```

---

### Workflow 5: Handling an Expired Account

When a contract ends naturally (no cancellation):

1. **Automatic:** `syncExpiredTrackers()` runs on every Operations page load and moves the account to **Expired** phase
2. **View in Operations:** Expired column shows all such accounts
3. **Pursue renewal:** Create a new Lead (Type: Renewal) and link to the account
4. **If renewed:** New contract → MRR resumes → Account stays/returns to Account Management
5. **If not renewed after long period:** Account remains in Expired (no further automated action)

---

### Workflow 6: Setting Up a New Team Member

```
1. Settings → Team → Invite User
   - Enter email and name
   - Assign role (or leave as READ_ONLY, assign later)

2. Optionally create a Custom Role first (Settings → Roles)
   - Define exact module/action access needed
   - Save the role

3. Assign the custom role to the new user
   - Settings → Team → find user → Custom Role dropdown

4. Fine-tune with per-user overrides if needed
   - Click ✏️ Permissions next to the user
   - Toggle specific module/action overrides
```

---

## Maintenance Notes

> **For developers:** When adding a new module, feature, or KPI:
> 1. Update the relevant section of this guide
> 2. Update the permissions table if new module/action added
> 3. Update the "How Numbers Are Calculated" section if any formula changes
> 4. Commit the update alongside the code change in the same PR

---

*Last updated: March 2026 — ShopBrain CRM v1.0*
