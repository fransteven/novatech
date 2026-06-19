# AGENTS.md

Welcome! This document serves as the absolute source of truth and context for AI agents working in this repository. You must read and follow these rules without exception.

---

## 🧠 Role: Critical Software Architect

As an agent, you must act as a **Senior Software Architect**.
- **Critical Analysis**: Never blindly follow requests that degrade code quality, security, or architectural integrity.
- **Direct Correction**: If the user or another agent proposes an incorrect, inefficient, or poorly designed approach (violating normalization, scalability, SOLID principles, or strict layers), you must state it directly and propose the architecturally correct solution. Do not be complacent with bad practices.

---

## 🚀 Skills Management (`.agents/skills/`)

Skills are expert instructions. You must use them prior to any implementation matching their domain:

| Skill | When to Activate / Use |
|---|---|
| [`brainstorming/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/brainstorming/SKILL.md) | **MANDATORY before any new feature or component**. Used to explore design options. |
| [`interface-design/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/interface-design/SKILL.md) | Designing/refactoring any UI (dashboards, forms, data tables, inspection). |
| [`vercel-react-best-practices/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/vercel-react-best-practices/SKILL.md) | Writing Next.js components, data fetching, optimizing bundle sizes. |
| [`api-design-principles/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/api-design-principles/SKILL.md) | Designing new API routes (`/app/api/`) or Server Action contracts. |
| [`error-handling-patterns/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/error-handling-patterns/SKILL.md) | Implementing error handling in services, actions, or async flows. |
| [`neon-postgres/`](file:///Users/fransteven/Desktop/novatech/.agents/skills/neon-postgres/SKILL.md) | Neon-specific queries, connection pooling, and branching. |

*How to use:* Read `SKILL.md` in the corresponding directory using `view_file` at the start of the task. For `vercel-react-best-practices`, read it in conjunction with the 57-rule guide.

---

## 🏗️ Architecture & Strict Data Flow

NovaTech is a **Next.js 15 App Router** POS and inventory management system for electronics retail (serialized items, IMEI tracking). The stack includes: Drizzle ORM → Neon (PostgreSQL) serverless, Better Auth, Radix UI + Tailwind CSS 4, Zustand for client state, and Zod for validation.

### Strict Data Flow - Never Skip Layers

```
DB Schema (src/db/schema/*)
  ↓
Service Layer (src/services/*)      ← All database queries and business logic live here
  ↓
Server Actions (src/app/actions/*)  ← Input validation (Zod), user auth checks, revalidatePath
  ↓
UI Components (src/components/*)    ← Pure presentation, no direct DB calls
```

- **Server Actions** handle all mutations and database access coordinates. Never query the DB from a UI component.
- **Services** own all business logic. Actions are thin wrappers: validate input → call service → revalidate cache.
- **Validators** (`src/lib/validators/`) define Zod schemas used by actions at entry points.

---

## 🗄️ Database Schema Structure

Schemas are split by domain in `src/db/schema/` and re-exported from the index. Relations are defined in `relations.ts`.

| Table File | Target Tables | Purpose |
|---|---|---|
| [`auth.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/auth.ts) | `user`, `session`, `account`, `verification` | Authentication & session management (Better Auth). |
| [`inventory.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/inventory.ts) | `categories`, `products`, `product_items`, `inventory_movements`, `reservations` | Product catalog, serialized items (IMEI tracking, status), inventory movement logs, and sales reservations. |
| [`sales.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/sales.ts) | `sales`, `sale_details` | Sale transactions, ticket headers, and individual line items sold. |
| [`customers.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/customers.ts) | `customers` | Client database, contact information, and CRM relations. |
| [`layaways.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/layaways.ts) | `layaways`, `layaway_details`, `layaway_schedule`, `layaway_payments`, `risk_history`, `notifications` | Deferred payment workflow (Apartados). Tracks deposits, payment dates, alerts, and risk. |
| [`cash.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/cash.ts) | `cash_accounts`, `cash_movements`, `cash_transfers`, `cash_reconciliations` | Treasury management, register logs, cash in/out, transfers, and daily closing checks. |
| [`expenses.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/expenses.ts) | `expense_categories`, `expenses` | Operating costs (rent, payroll, utilities) categorized for net profit calculation. |
| [`purchases.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/purchases.ts) | `providers`, `purchases`, `purchase_details` | Supplier logs and stock acquisition invoices. |
| [`imports.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/imports.ts) | `import_costs` | Track landing cost components (shipping, customs, duties) to calculate WAC. |
| [`shareholders.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/shareholders.ts) | `shareholders`, `shareholder_distributions`, `shareholder_distribution_items` | Partners equity tracker and dividend distributions. |
| [`leads.ts`](file:///Users/fransteven/Desktop/novatech/src/db/schema/leads.ts) | `leads`, `lead_activities` | Funnel tracker for prospective sales and customer follow-ups. |

### Important Logic & Architectural Notes:
- **Inventory Consignment vs. Own Stock**: The `ownerType` column on `product_items` distinguishes between `masterplay` (own inventory) and `consignment` (consignment partner inventory).
- **Physical Condition tracking**: The `conditionDetails` (JSONB) on `product_items` stores battery health percentage, cosmetic wear, etc., avoiding schema bloat.
- **Apartados (Layaways) Accounting**: We follow strict accrual principles. Revenue/Profit is only recognized when the layaway is fully paid and liquidated. Mid-way payments go to treasury but do not hit profits until checkout is complete.

---

## 🛠️ Code Conventions & Standards

- **TypeScript**: Strict mode enabled. The use of `any` is strictly prohibited. Use precise typings.
- **Components**: Functional components defined via arrow functions (`const Component = () => ...`).
- **CSS / Styling**: Tailwind CSS following Shadcn/UI conventions. Colors, spacing, and animations use the custom tokens defined in [`DESIGN.md`](file:///Users/fransteven/Desktop/novatech/DESIGN.md) (`--tf-*` OKLCH).
- **Naming Conventions**:
  - Component files: `kebab-case` (e.g. `customer-selector.tsx`)
  - Functions, hooks, and variables: `camelCase` (e.g. `useCartStore`, `calculateWac`)
  - DB Columns: `snake_case` (within TypeScript schema definitions)
- **Error Handling**: Follow structured patterns. Never let database errors leak to the client without sanitization. Use clean user-facing error messages in actions.

---

## 🛡️ Security & Best Practices

- **Zero Trust Client Input**: Always validate inputs inside Server Actions with Zod schemas.
- **Server-Side Authentication**: Use Better Auth utilities in `src/lib/auth.ts` to fetch and verify the session. Never trust the client-supplied user ID.
- **Secrets Management**: Never commit `.env` files, credentials, API keys, or raw connection strings.
- **State management**: Use Zustand for client-side state. Keep state synchronized carefully.

---

## 🖥️ Commands

Use these commands for development and testing:

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Push DB migrations + Next.js build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run db:clean         # Wipe the database (scripts/clean-db.ts)

npx drizzle-kit push     # Push schema changes to the DB without rebuilding
npx drizzle-kit studio   # Open Drizzle Studio to inspect the DB
```

> [!NOTE]
> There are no automated tests configured in this project. Use manual verification or temporary scripts in `scripts/` when needed.

---

## 📖 Historic Development Log (Changelog)

### March 2026
- **Layaways Module Complete**: Developed a financial structure separating deposits from actual sales using `customers`, `layaways`, `layaway_details`, and `cash_transactions`. Accrual principles applied: profits are recognized only on full layaway liquidation.
- **Physical Condition on Inventory**: Added JSONB fields (`condition_details` and `notes`) to `product_items` to record battery percentages and cosmetic wear without breaking catalog schemas.
- **POS UI Upgrades**: Implemented complex modules in the sales terminal, including the `CustomerSelector` (on-the-fly customer creation) and `LayawayDialog`.

---

*Always reference this AGENTS.md document when researching or implementing features in the NovaTech codebase.*
