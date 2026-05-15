# NovaTech Interface Design System

## Core Identity: "The Technical Terminal"

Used for critical workflows like hardware inspection, peritaje, and high-responsibility certification.

### Visual Foundations
- **Surfaces:** Whisper-quiet shifts using `bg-muted/30` for containers and `bg-background` for the main canvas.
- **Borders:** Subtle `border-border/50` for structure. Use `border-l-4` with semantic colors to indicate status (Primary = Active, Green = Completed, Red = Rejected).
- **Typography:** Heavy use of `text-[10px]` for metadata and labels, keeping `text-sm` for primary actions. Monospace for technical data (IMEI, Battery %).

### Component Patterns

#### 1. Sequential Phase Blocking (Workflow)
- **Concept:** Prevent user errors by locking future steps until the current phase is valid.
- **Visual:** Use a Backdrop blur + Lock icon overlay on disabled phases. Reduce opacity to 60% and apply grayscale.
- **Interaction:** Automatically scroll or highlight the next phase upon completion.

#### 2. The "Kill Switch" (Critical Failure)
- **Concept:** Interrupt the entire process if a "Critical Item" fails.
- **Visual:** A global `Alert` banner in `destructive` mode. The entire terminal enters a read-only state until reset.
- **UX:** Clearly state the reason for rejection to avoid ambiguity in front of the customer.

#### 3. Contextual Documentation (Side Sheets)
- **Concept:** Keep the technical protocol accessible without losing context of the inspection.
- **Pattern:** Use a `Sheet` (Side Panel) triggered by an info icon.
- **Content:** Structure with "Técnica de Inspección", "Criterio de Rechazo", and "Recomendación Pro".

### Spacing & Layout
- **Base Unit:** 4px (Tailwind standard).
- **Cards:** Padding `p-4` or `p-6` depending on density needs.
- **Mobile First:** All inspection grids must use `grid-cols-1 md:grid-cols-2` to ensure accessibility on small screens.
