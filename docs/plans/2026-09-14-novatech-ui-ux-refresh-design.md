# NovaTech UI/UX refresh — Archivo Control Deck

## Intent

The operator is at a counter, receiving serialized stock, locating an IMEI, charging a ticket, or reconciling cash. They need a compact, calm record of what happened and a clearly signalled next action. The design uses paper, aluminum and carbon ink with orange reserved for an action or trace state.

Domain vocabulary explored: receiving ledger, IMEI label, trace rail, cash close, equipment serial, inspection record, controlled handoff. The color world is paper white, aluminum gray, carbon, printed orange, receipt amber and status green. The signature is the orange trace rail with a compact mono marker. It replaces generic gradient logos, four identical KPI cards, decorative glass panels and centered detail modals.

## Delivery checkpoints

1. Establish the documented token system, transparent chrome rules, motion budget, Archivo plus Plex Mono typography, and solid UI primitives.
2. Normalize the application shell: 56px topbar, responsive 68/232px sidebar, accessible skip target, PageShell and shared table/detail loading affordances.
3. Replace the dashboard placeholder with authenticated, parallelized service data: KPIs, a 30-day sales trend and recent operations.
4. Make the shared primitives carry master-detail and responsive table behavior so existing TanStack/Radix implementations retain their selection, filters and pagination while acquiring consistent rails, surfaces and mobile record cards.
5. Apply targeted cleanup where legacy literal indigo/gradients violate the system; retain current Zod/RHF payloads, idempotency and financial calculations.

## Follow-up scope recorded during implementation

- All 18 routes under `(main)` use `PageShell`; the root redirect and the two authentication routes complete the 21 public routes in this application tree.
- Read workflows use the shared right-side `DetailSheet`; write flows remain in their existing Dialog/Sheet/AlertDialog primitives so their RHF, Zod, idempotency and action contracts remain unchanged.
- Creditor and lead inspectors intentionally retain their existing in-sheet edit workspaces: opening a record is read-only, while each explicit control still owns its mutation. Splitting those workspaces would duplicate validated action state without a UX or safety gain.
- `react-day-picker` is not installed. A date picker migration would add a new dependency and require a form-by-form RHF value audit, so native date controls remain deliberately deferred. Existing fields retain the canonical local `YYYY-MM-DD` contract.

## Architecture constraints

The database remains reachable only through services. Dashboard reads are orchestrated by an authenticated server action, which calls service functions in parallel. UI components receive serializable data only and do not make database calls. Dialogs remain for mutations, detail Sheets for read/inspect workflows, and AlertDialogs for irreversible confirmation.

## Verification

- Run whitespace diff validation, TypeScript, the Vitest suite, lint and `npx next build` (never `npm run build`, which pushes migrations).
- Inspect light/dark at desktop and phone widths, verify keyboard focus/Escape/sheet return focus, and test Cmd/Ctrl+K.
- Treat unrelated existing warnings as baseline, but do not leave a new failure unaddressed.
