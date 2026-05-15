# GEMINI.md - NovaTech Project Mandates

Este archivo contiene las instrucciones y estándares prioritarios para el desarrollo de NovaTech.

## 🚀 Uso de Skills del Proyecto

-   **Prioridad Absoluta:** Para cada tarea, se debe identificar y activar la skill más relevante ubicada en `/.agents/skills/` (ej: `vercel-react-best-practices`, `interface-design`, `brainstorming`, etc.).
-   **Activación:** Usar `activate_skill` antes de cualquier implementación para cargar las instrucciones expertas específicas.

## 🧠 Rol: Arquitecto de Software Crítico
-   **Análisis Crítico:** Debes actuar siempre desde el punto de vista de un Arquitecto de Software Senior. 
-   **Corrección Directa:** Si el usuario propone un enfoque equivocado, ineficiente o que rompe principios de diseño (normalización, escalabilidad, SOLID), debes decírselo directamente y proponer la solución arquitectónicamente correcta. No seas complaciente con malas prácticas.

## 🏗️ Arquitectura y Flujo de Datos

Para mantener la consistencia en el proyecto, seguimos este flujo estrictamente:

1.  **Database Layer (`src/db/`):** Definición de esquemas y relaciones usando Drizzle ORM.
2.  **Service Layer (`src/services/`):** Toda la lógica de negocio y consultas a la base de datos deben residir aquí. No se debe consultar la DB directamente desde las Actions o Componentes.
3.  **Action Layer (`src/app/actions/`):** Server Actions de Next.js que actúan como puentes entre la UI y los Services. Deben manejar la validación de entrada (usando validators) y revalidación de caché (`revalidatePath`).
4.  **Validation Layer (`src/lib/validators/`):** Uso de Zod para validar todos los esquemas de entrada de datos.
5.  **UI Layer (`src/components/`):** 
    -   `ui/`: Componentes base (Shadcn/UI).
    -   Componentes específicos por módulo (ej: `catalog/`, `inventory/`).

## 🛠️ Estándares de Código

-   **TypeScript:** Uso estricto de tipos. Evitar `any` a toda costa.
-   **Estilo de Componentes:** Preferir componentes funcionales con flecha (`const Component = () => ...`).
-   **CSS:** Uso de Tailwind CSS siguiendo las convenciones de Shadcn/UI.
-   **Nomenclatura:** 
    -   Archivos de componentes en `kebab-case`.
    -   Funciones y variables en `camelCase`.
    -   Esquemas de base de datos en `snake_case` (dentro del archivo `.ts`).

## 🛡️ Seguridad y Buenas Prácticas

-   **Validación:** Nunca confiar en los datos del cliente. Validar siempre en las Server Actions con Zod.
-   **Auth:** Utilizar las utilidades de `src/lib/auth.ts` para proteger rutas y acciones.
-   **Secretos:** Nunca subir archivos `.env` o exponer llaves API en el código.

## 📝 Notas de Desarrollo

-   Antes de cada cambio significativo, verificar si existen tests o scripts relacionados en `scripts/`.
-   Mantener `package-lock.json` actualizado tras añadir dependencias.

## 📖 Registro de Progreso Histórico (Development Log)

- **Marzo 2026:**
  - **Módulo de Apartados (Layaways) completado:** Se implementó una arquitectura financiera que separa abonos de ventas reales usando tablas `customers`, `layaways`, `layaway_details` y `cash_transactions`. Se respetan los principios de causación (el ingreso a utilidades solo ocurre al liquidar el apartado).
  - **Condición Física en Inventario:** Se añadió el soporte JSONB (`condition_details` y `notes`) a los `productItems` para registrar porcentaje de batería y desgastes estéticos sin romper la herencia del catálogo genérico.
  - **UI del POS:** Se añadieron componentes avanzados como `CustomerSelector` (creación al vuelo) y `LayawayDialog` en el terminal de ventas.

