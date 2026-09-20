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

NovaTech is a **Next.js 16 App Router** / **React 19** POS and inventory management system for electronics retail (serialized items, IMEI tracking). The stack includes: Drizzle ORM → Neon (PostgreSQL) serverless, Better Auth, Radix UI + Tailwind CSS 4, Zustand for client state, and Zod for validation.

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
- **Nuevo vs. segunda mano**: `product_items.condition` (`new` | `used` | `refurbished`) es un dato de la **unidad física**, no del catálogo: el mismo modelo convive nuevo y usado con costo, precio y garantía distintos. Los productos no serializados no tienen fila en `product_items` y se asumen nuevos. El vocabulario (labels, presets de garantía) vive en `src/lib/validators/inventory-validator.ts`.
- **Precedencia de meses de garantía** (`resolveWarrantyRow`): `warranties.warranty_months` (snapshot) → `product_items.warranty_months` (cobertura pactada para esa unidad; presets 1/3/6 meses) → `products.warranty_months` (política del modelo) → `DEFAULT_WARRANTY_MONTHS` (3).
- **Physical Condition tracking**: The `conditionDetails` (JSONB) on `product_items` stores battery health percentage, cosmetic wear, etc., avoiding schema bloat.
- **Apartados (Layaways) Accounting**: We follow strict accrual principles. Revenue/Profit is only recognized when the layaway is fully paid and liquidated. Mid-way payments go to treasury but do not hit profits until checkout is complete.
- **Documentos Ficticios / Provisionales**: Ver sección detallada abajo. Todo documento provisional de cliente DEBE seguir el formato `FIC-XXXXXX` (6 dígitos) y toda factura ficticia el formato `FIC-XXXXXXX` (7 dígitos, ej. `FIC-0000001`) con consecutivo numérico único y creciente.

---

## 📑 Convención Obligatoria: Documentos Ficticios y Provisionales (Clientes, Facturas y Artículos)

Para respetar las restricciones `UNIQUE` de la base de datos (`customers.document_id` y el índice único parcial de `product_items.serial_number`), y permitir que cualquier registro provisional pueda ser identificado, rastreado y actualizado fácilmente en el futuro, **todos los agentes y desarrolladores deben seguir estrictamente esta convención**:

### 1. Documentos Ficticios de Cliente (`customers.document_id`)
- **Prohibición Absoluta**: NUNCA inventar cédulas aleatorias, números de teléfono, secuencias como `"12345678"`, `"0000"` o cadenas como `"test"`. Causan colisiones con el constraint `UNIQUE` (error Postgres `23505`) y corrompen la integridad del CRM.
- **Estructura Oficial**: Prefijo `FIC-` seguido de un consecutivo numérico de 6 dígitos relleno con ceros a la izquierda.
  - Formato exacto: `FIC-000001`, `FIC-000002`, `FIC-000003`, etc.
  - Longitud: 10 caracteres (cumple con la validación `min(4)` de Zod en [`customer-validator.ts`](file:///Users/fransteven/Desktop/novatech/src/lib/validators/customer-validator.ts)).
- **Regla del Consecutivo**: La estructura es fija y **solo cambia el número consecutivo**. Al crear un nuevo cliente ficticio, debe tomarse el siguiente consecutivo disponible en la base de datos usando [`getNextFictitiousCustomerDoc`](file:///Users/fransteven/Desktop/novatech/src/lib/fictitious-documents.ts).
- **Casos de Uso**:
  - Clientes para pruebas automatizadas, seeds y entornos de desarrollo.
  - Ventas, apartados, garantías o cotizaciones de artículos donde el cliente final no posea o no entregue su documento real al momento de la compra (mostrador rápido).
- **Rastreo y Reemplazo Posterior**:
  - Para consultar todos los clientes con documentos ficticios pendientes de actualizar:
    ```sql
    SELECT id, document_id, name, phone FROM customers WHERE document_id LIKE 'FIC-%';
    ```
  - En el POS: Escribir `"FIC-"` en el buscador de clientes para filtrarlos de inmediato.
  - Para actualizar el documento del cliente al valor real definitivo:
    ```sql
    UPDATE customers SET document_id = '1116789432' WHERE document_id = 'FIC-000001';
    ```
    O usando el Server Action [`updateCustomerAction`](file:///Users/fransteven/Desktop/novatech/src/app/actions/customer-actions.ts).

### 2. Facturas de Compra Ficticias y Provisionales (`purchases.invoice_number`)
- **Prohibición Absoluta**: NUNCA inventar números de factura aleatorios, letras al azar o cadenas como `"FAC-123"`, `"factura-test"`, `"000"`, `"test"`. Rompe la trazabilidad del módulo de compras, ensucia los filtros y perjudica la consistencia del sistema contable y de auditoría.
- **Estructura Oficial**: Prefijo `FIC-` seguido de un consecutivo numérico de 7 dígitos con ceros a la izquierda (o alternativamente `FAC-FIC-` para compatibilidad con registros legados).
  - Formato exacto: `FIC-0000001`, `FIC-0000002`, `FIC-0000003`, etc.
  - Longitud: 11 caracteres.
- **Regla del Consecutivo Único y Dinámico**: Cuando el usuario solicite una factura ficticia a los agentes, el agente DEBE entregar siempre una factura ficticia válida y **distinta en cada solicitud**.
  - Para calcular el siguiente número único disponible sin romper la integridad de la base de datos, debe consultarse la base de datos con [`getNextFictitiousInvoiceNumber`](file:///Users/fransteven/Desktop/novatech/src/lib/fictitious-documents.ts) (o consultar `purchases.invoice_number` con prefijo `FIC-` o `FAC-FIC-` para obtener el máximo consecutivo e incrementar en 1).
  - Si la base de datos no tiene facturas ficticias registradas aún, la primera factura ficticia oficial a retornar es `FIC-0000001`. Si ya existe `FIC-0000001`, el agente debe retornar `FIC-0000002`, y así sucesivamente de manera incremental.
- **Casos de Uso**:
  - Facturas ficticias para compras de prueba, tests unitarios, seeds o entornos de desarrollo.
  - Compras reales donde el proveedor aún no ha emitido o entregado la factura legal definitiva y se necesita ingresar la mercancía a bodega de forma provisional.
- **Rastreo y Reemplazo Posterior**:
  - Para consultar compras con facturas ficticias pendientes de actualizar con la factura legal definitiva:
    ```sql
    SELECT id, invoice_number, provider_id, total_amount, purchase_date 
    FROM purchases 
    WHERE invoice_number LIKE 'FIC-%' OR invoice_number LIKE 'FAC-FIC-%';
    ```
  - En la UI de Compras: Escribir `"FIC-"` en el filtro de búsqueda para ubicarlas inmediatamente.

### 3. Artículos e Inventario sin Documento / Serial Real
- **Artículos No Serializados** (accesorios, cargadores, fundas):
  - Mantener `isSerialized = false` y `product_items.serial_number = NULL`.
  - El índice único parcial en PostgreSQL ignora `NULL`. NUNCA asignar strings como `"."`, `"sin serial"` o `"N/A"`.
- **Artículos Serializados Provisionales** (pruebas o ingreso donde el IMEI aún no está disponible):
  - Usar la estructura: `SN-FIC-XXXXXX` (ej. `SN-FIC-000001`).

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
npm run test             # Run vitest in watch mode
npm run test:run         # Run vitest once (CI / single pass)

npx drizzle-kit push     # Push schema changes to the DB without rebuilding
npx drizzle-kit studio   # Open Drizzle Studio to inspect the DB
```

> [!NOTE]
> Vitest is configured (`vitest.config.ts`). Use `npm run test:run` for a single-pass run. For ad-hoc data fixes or manual verification, use temporary scripts in `scripts/`.

---

## 📖 Historic Development Log (Changelog)

### Septiembre 2026
- **Estándar de Facturas Ficticias (`FIC-XXXXXXX`)**: Regla obligatoria para que los agentes y desarrolladores generen facturas ficticias reproducibles y seguras con prefijo `FIC-` + consecutivo numérico de 7 dígitos (ej. `FIC-0000001`, `FIC-0000002`). Centralizado en [`fictitious-documents.ts`](file:///Users/fransteven/Desktop/novatech/src/lib/fictitious-documents.ts) con `getNextFictitiousInvoiceNumber()`, garantizando que cada petición retorne una factura distinta basada en el consecutivo más alto existente en la base de datos sin romper la integridad referencial ni la trazabilidad de auditoría.
- **Estándar de Documentos Ficticios (`FIC-XXXXXX`)**: Definida la convención obligatoria para clientes de prueba y artículos sin documento real. Usa prefijo `FIC-` + consecutivo de 6 dígitos numéricos (`FIC-000001`), evitando colisiones con la restricción `UNIQUE` en `customers.document_id`. Módulo centralizado en [`fictitious-documents.ts`](file:///Users/fransteven/Desktop/novatech/src/lib/fictitious-documents.ts) con detección, formateo y generación de consecutivo (`getNextFictitiousCustomerDoc`). Agregadas funciones `updateCustomer` y `updateCustomerAction` para posibilitar el reemplazo rápido posterior del documento provisional por el real. Creado cliente de prueba inicial (`FIC-000001`).

### Agosto 2026
- **Garantías consultables por cualquier dato**: `searchWarranties()` reemplaza al match exacto por serial. Busca por IMEI parcial y normalizado (`serialSearchKey` en `src/lib/serials.ts` quita espacios y guiones a ambos lados), nombre/cédula/teléfono del cliente, producto, N° (prefijo) de venta o apartado, y rango de fechas de entrega. La unidad de resultado es la **línea de entrega**, no la unidad física, así que los accesorios no serializados también tienen garantía: `warranties.product_item_id` es nullable y se agregaron `sale_detail_id` / `layaway_detail_id` con un CHECK de "al menos un ancla".
- **`sales.customer_id` se poblaba nunca**: el POS mandaba el id del cliente en el slot de `userId`. Ahora el vendedor sale de la sesión en el server action (zero-trust) y el cliente viaja como `customerId`. `scripts/backfill-sale-customer-id.ts` corrigió el histórico.
- **Entregas que no ocurrieron**: la garantía solo arranca con `sales.status = 'completed'` y `layaways.status IN ('active','completed','defaulted')` — una cotización o un apartado cancelado ya no inicia cobertura. `warranties.status = 'void'` ahora sí se lee (`sin_cobertura`).
- **Módulo de Compras endurecido**: `createPurchase` recalcula subtotal/total en el servidor, lee `isSerialized` del catálogo (nunca del payload) y es idempotente (`purchases.idempotency_key`). El total del cliente sólo se usa como verificación.
- **Costo aterrizado (landed cost)**: nueva tabla `purchase_extra_costs` (flete, casillero, arancel, comisión). Se prorratea por valor de línea en centavos con mayor residuo (`src/lib/purchase-costs.ts`) y se escribe en `product_items` / `inventory_movements`, que es lo que `resolveItemCost` lee al vender. `purchase_details` guarda costo de factura y `landed_unit_cost`.
- **Compras a crédito**: `purchases.payment_status` + `amount_paid` y nueva tabla `purchase_payments` (con `cash_movement_id` e idempotencia, igual que `layaway_payments`). Sin abono no se crea movimiento de caja; `account_id` pasó a nullable.
- **Entrada de inventario unificada**: `inventory-service.receiveStockLines(tx, lines)` es el único punto que crea `product_items` + `inventory_movements`; lo usan tanto el ingreso manual (`receiveStock`) como las compras. Valida seriales (normalizados, sin repetidos ni colisiones) e inserta en lote.
- **Índice único parcial** sobre `product_items.serial_number` — antes se podían duplicar IMEIs.

### March 2026
- **Layaways Module Complete**: Developed a financial structure separating deposits from actual sales using `customers`, `layaways`, `layaway_details`, and `cash_transactions`. Accrual principles applied: profits are recognized only on full layaway liquidation.
- **Physical Condition on Inventory**: Added JSONB fields (`condition_details` and `notes`) to `product_items` to record battery percentages and cosmetic wear without breaking catalog schemas.
- **POS UI Upgrades**: Implemented complex modules in the sales terminal, including the `CustomerSelector` (on-the-fly customer creation) and `LayawayDialog`.

---

*Always reference this AGENTS.md document when researching or implementing features in the NovaTech codebase.*

