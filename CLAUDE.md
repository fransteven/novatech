# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Push DB migrations + Next.js build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:clean     # Wipe the database (scripts/clean-db.ts)

npx drizzle-kit push     # Push schema changes to the DB without rebuilding
npx drizzle-kit studio   # Open Drizzle Studio to inspect the DB
```

There are no automated tests configured in this project.

## Architecture

NovaTech is a **Next.js 15 App Router** POS and inventory management system for electronics retail (serialized items, IMEI tracking). The stack: Drizzle ORM → Neon (PostgreSQL) serverless, Better Auth, Radix UI + Tailwind CSS 4, Zustand for client state, Zod for validation.

### Strict data flow — never skip layers

```
DB Schema (src/db/schema/)
  ↓
Service Layer (src/services/)      ← all DB queries live here
  ↓
Server Actions (src/app/actions/)  ← validate with Zod, revalidatePath
  ↓
UI Components (src/components/)    ← no direct DB calls
```

- **Server Actions** handle all mutations. Never call the DB from a component or pass raw DB results to the client without going through an action.
- **Services** own all business logic. Actions are thin: validate → call service → revalidate cache.
- **Validators** (`src/lib/validators/`) define Zod schemas that actions use at entry points.

### Database schema structure

Schemas are split by domain in `src/db/schema/` and re-exported from the index. Key tables:

| Table | Purpose |
|---|---|
| `products` | Generic catalog items (isSerialized flag, JSONB attributes) |
| `product_items` | Individual serialized units (IMEI, status, ownerType, conditionDetails JSONB) |
| `owners` | Consignment partners |
| `inventory_movements` | Full stock history |
| `sales` / `sale_details` | Transaction header + line items |
| `layaways` / `layaway_details` | Apartado (deferred payment) workflow |
| `customers` | Customer directory |
| `expenses` | Operational expenses |

`ownerType` distinguishes `masterplay` (own inventory) from `consignment` (partner inventory). `conditionDetails` (JSONB) on `product_items` stores battery %, cosmetic wear, etc. without altering the base schema.

### Key modules

- **POS** (`src/app/(main)/pos/`) — sale terminal with cart, CustomerSelector, LayawayDialog
- **Inventory** (`src/app/(main)/inventory/`) — stock management, WAC cost calculation, receive stock
- **Layaways** (`src/app/(main)/layaways/`) — apartados lifecycle (income recognized only on liquidation)
- **iPhone Purchase Checklist** (`src/app/(main)/iphone-purchase-checklist/`) — sequential inspection protocol with critical-failure kill-switch
- **Catalog** — product/category CRUD with JSONB attribute templates per category

### Auth

Better Auth (`src/lib/auth.ts` / `src/lib/auth-client.ts`). All protected routes are under `(main)/` layout. Protect server actions using the auth utilities, never trust client-supplied identity.

## Code conventions

- TypeScript strict — no `any`
- Functional components with arrow functions
- Naming: component files `kebab-case`, functions/variables `camelCase`, DB columns `snake_case`
- Tailwind CSS following Shadcn/UI conventions; base UI primitives live in `src/components/ui/`

## Interface design system

For critical workflows (inspection, certification), follow the **"Technical Terminal"** patterns defined in `.interface-design/system.md`:

1. **Sequential Phase Blocking** — lock future phases with blur + lock icon overlay until current phase passes
2. **Kill Switch** — destructive `Alert` banner that freezes the terminal when a critical item fails
3. **Contextual Protocol Sheets** — `Sheet` side panel (info icon trigger) with Técnica de Inspección / Criterio de Rechazo / Recomendación Pro sections

Typography: `text-[10px]` for metadata, `text-sm` for actions, monospace for technical data (IMEI, serial numbers). Cards: `p-4` / `p-6`. All inspection grids: `grid-cols-1 md:grid-cols-2`.

## Skills (.agents/skills/)

Skills are expert instruction files downloaded from skill.sh. **Read the relevant `SKILL.md` before starting any task that matches its domain.**

| Skill | When to activate |
|---|---|
| `brainstorming/` | **Before any new feature or component** — explore intent, constraints, and 2-3 design approaches before writing code |
| `interface-design/` | Designing or refactoring any UI — dashboards, forms, data tables, inspection workflows |
| `vercel-react-best-practices/` | Writing or reviewing React/Next.js components, data fetching, bundle size concerns |
| `api-design-principles/` | Designing new API routes (`/app/api/`) or Server Action contracts |
| `error-handling-patterns/` | Implementing error handling in services, actions, or async flows |
| `neon-postgres/` | Neon-specific questions — connection pooling, branching, serverless driver, scale-to-zero |

**How to use:** Read `.agents/skills/<skill-name>/SKILL.md` at the start of the relevant task. For `vercel-react-best-practices`, also read `AGENTS.md` (full 57-rule guide).

The `brainstorming` skill writes validated designs to `docs/plans/YYYY-MM-DD-<topic>-design.md` — check that directory for prior design decisions before implementing a feature.

## Environment variables

```
DATABASE_URL              # Neon PostgreSQL connection string
BETTER_AUTH_SECRET        # Session signing key (min 32 chars)
BETTER_AUTH_URL           # Server-side auth base URL
NEXT_PUBLIC_BETTER_AUTH_URL  # Client-side auth base URL
MARKETING_API_KEY         # Key for /api/marketing/* routes
```
