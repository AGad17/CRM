# ShopBrain CRM — Data Import Guide

## Overview

There are **4 CSV files** to fill in. You must do them **in order**
because each file references the one before it.

```
1. accounts.csv         ← start here (your client list)
2. contracts.csv        ← one contract per row, linked to an account
3. contract-items.csv   ← one line item per row, linked to a contract
4. leads.csv            ← active pipeline + historical closed leads (optional)
```

---

## Step 1 — Reset existing data

```bash
node scripts/reset-data.js
```

Type **YES** when prompted. This deletes all accounts, contracts, leads, deals,
invoices, and onboarding records.
Users, countries, and product catalog are **not** touched.

---

## Step 2 — Fill in the CSV files

Open each file in **Excel** or **Google Sheets** and fill in your data.

### Rules that apply to all files
- **Delete the `#` comment rows** before saving — they are for reference only.
- **Do not rename columns** — the import script reads them by header name.
- **Dates** must be in `YYYY-MM-DD` format (e.g. `2024-01-15`).
- **Numbers** should not include currency symbols (just `3000`, not `SAR 3,000`).
- **Leave optional fields blank** — do not write "N/A" or "-".

---

## File 1 · accounts.csv — Your Client List

| Column | Required | Description |
|--------|----------|-------------|
| `account_name` | ✅ | Full name of the client company. Must be **unique**. |
| `country` | ✅ | `Egypt` / `KSA` / `UAE` / `Bahrain` / `Jordan` |
| `lead_source` | ✅ | How you acquired the client. See values below. |
| `brands` | | Number of distinct brands (default: **1**) |
| `branches` | | Total number of outlets/locations (default: **1**) |
| `cost_centres` | | Number of cost centres (optional) |
| `external_code` | | Your internal ERP/CRM reference code (optional) |

**lead_source values:**
`Foodics` · `EmployeeReferral` · `CustomerReferral` · `PartnerReferral` ·
`Website` · `AmbassadorReferral` · `DirectSales` · `Sonic` · `Historical`

> 💡 Use `Historical` for accounts you migrated from a previous system
> where you don't know the original lead source.

---

## File 2 · contracts.csv — Contract Records

Each account can have **multiple contracts** (original, renewal, expansion).
Add one row per contract.

| Column | Required | Description |
|--------|----------|-------------|
| `account_name` | ✅ | Must match **exactly** what you wrote in accounts.csv |
| `contract_type` | ✅ | `New` / `Renewal` / `Expansion` |
| `start_date` | ✅ | `YYYY-MM-DD` |
| `end_date` | ✅ | `YYYY-MM-DD` |
| `contract_value` | ✅ | Total value in **local currency** for the full contract period |
| `usd_rate` | | Exchange rate at signing (e.g. `3.75` for SAR→USD) |
| `cancellation_date` | | Date the contract was cancelled. **Leave blank** if still active. |

**How to calculate contract_value:**
```
contract_value = monthly_MRR × contract_duration_in_months
Example: 1,000 SAR/month × 24 months = 24,000
```

> 💡 If an account renewed, add **two rows** — one for the original contract
> (with or without a cancellation_date) and one for the renewal.

---

## File 3 · contract-items.csv — Line Items

Each contract has one or more **line items** (e.g. one per product/module).
This is what drives MRR calculations.

| Column | Required | Description |
|--------|----------|-------------|
| `account_name` | ✅ | Must match accounts.csv |
| `contract_start_date` | ✅ | Must match the `start_date` in contracts.csv for this account |
| `description` | ✅ | Free text (e.g. `Enterprise Plan`, `Warehouse Module`, `AI Agent`) |
| `quantity` | ✅ | Units (e.g. number of branches for per-branch pricing) |
| `unit_price` | ✅ | Price per unit per **payment period** in local currency |
| `payment_plan` | ✅ | `Yearly` / `Quarterly` / `OneTime` |
| `discount_pct` | | Discount percentage on this line (e.g. `10` = 10%). Leave blank for 0%. |

**How MRR is derived from line items:**

| Payment Plan | MRR Contribution |
|---|---|
| `Yearly` | `(quantity × unit_price × (1 − discount/100)) ÷ 12` |
| `Quarterly` | `(quantity × unit_price × (1 − discount/100)) ÷ 3` |
| `OneTime` | `0` (counted in contract value only, not MRR) |

**Example for a 25-branch account:**
```
description: Foodics Enterprise Plan
quantity: 25
unit_price: 3,000   (per branch per year in SAR)
payment_plan: Yearly
→ MRR = (25 × 3,000) / 12 = SAR 6,250/month
```

---

## File 4 · leads.csv — Pipeline (Optional)

Only fill this in if you want to track your active sales pipeline in the CRM.

| Column | Required | Description |
|--------|----------|-------------|
| `company_name` | ✅ | Prospect company name |
| `contact_name` | | Primary contact |
| `contact_email` | | |
| `contact_phone` | | |
| `channel` | ✅ | Same values as `lead_source` in accounts.csv |
| `country` | | `Egypt` / `KSA` / `UAE` / `Bahrain` / `Jordan` |
| `estimated_value` | | Estimated monthly MRR in local currency |
| `branches` | | Estimated number of branches |
| `package_interest` | | `Essential` / `Operations` / `Enterprise` |
| `stage` | | `Lead` / `Qualified` / `ClosedWon` / `ClosedLost` (default: `Lead`) |
| `lost_reason` | | **Required** if stage = `ClosedLost` |
| `expected_close_date` | | Target close date `YYYY-MM-DD` |
| `owner_email` | ✅ | Email of the CRM user who owns this lead (must exist in Settings → Team) |
| `opportunity_type` | | `New` / `Renewal` / `Upsell` / `Expansion` |
| `notes` | | Free text |
| `account_name` | | Link to an existing account from accounts.csv (leave blank for new prospects) |

---

## Step 3 — Validate (dry run)

Before committing, run a dry-run to catch any errors:

```bash
node scripts/import-data.js --dry-run
```

This prints what **would** be created without touching the database.
Fix any errors reported, then proceed to the real import.

---

## Step 4 — Import

```bash
node scripts/import-data.js
```

The script will print a summary:
```
✅  Import complete.

   Accounts   — 48 imported
   Contracts  — 73 imported
   Items      — 142 imported
   Leads      — 12 imported
```

---

## Step 5 — Set up users (if not done)

Go to **Settings → Team** in the CRM and invite your team members
before adding leads, since each lead requires an `owner_email`.

Default admin account:
- Email: `admin@shopbrain.com`
- Password: `Admin@123`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Account "X" not found` | Make sure the account_name in contracts.csv matches accounts.csv **exactly** (case-sensitive) |
| `Country "X" not found` | Use the exact spelling: `Egypt`, `KSA`, `UAE`, `Bahrain`, `Jordan` |
| `"X" is not valid for lead_source` | Check the allowed values in the Field Reference above |
| `Invalid date "X"` | Use `YYYY-MM-DD` format, e.g. `2024-01-15` |
| `User with email "X" not found` | Add the user in Settings → Team first, then re-run import |
| `No contract found for account "X"` | The `contract_start_date` in contract-items.csv must exactly match `start_date` in contracts.csv |

---

## Re-running the import

If you need to fix errors and re-import, run the reset first:

```bash
node scripts/reset-data.js --confirm && node scripts/import-data.js
```

> ⚠️ The `--confirm` flag skips the interactive prompt. Use with care.
