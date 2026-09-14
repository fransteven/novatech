import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const OperationsMark = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path d="M4 7.5h16M4 12h16M4 16.5h10" strokeLinecap="round" />
    <path d="M17 15.5v3M15.5 17h3" strokeLinecap="round" />
  </svg>
);

const OperationalSignal = ({
  code,
  title,
  detail,
}: {
  code: string;
  title: string;
  detail: string;
}) => (
  <div className="grid grid-cols-[2.75rem_1fr] gap-4 border-t border-white/12 py-4 first:border-t-0 first:pt-0">
    <span className="mono pt-0.5 text-[0.6875rem] font-medium tracking-[0.12em] text-white/45">
      {code}
    </span>
    <div>
      <p className="text-sm font-medium tracking-[-0.01em] text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-white/58">{detail}</p>
    </div>
  </div>
);

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      <aside className="relative hidden overflow-hidden bg-[var(--tf-fg)] px-10 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-14">
        <div aria-hidden="true" className="absolute inset-0 opacity-30">
          <div className="absolute inset-x-0 top-[17%] border-t border-white/20" />
          <div className="absolute inset-x-0 top-[17.85%] border-t border-white/10" />
          <div className="absolute inset-x-0 bottom-[21%] border-t border-white/12" />
          <div className="absolute bottom-[21%] left-[14%] top-[17%] border-l border-white/10" />
          <div className="absolute bottom-[21%] left-[14.8%] top-[17%] border-l border-white/5" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/8 text-white">
            <OperationsMark />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-white">NovaTech</p>
            <p className="mono mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-white/50">
              Operaciones comerciales
            </p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <p className="mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-white/45">
            Punto de control
          </p>
          <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-white xl:text-5xl">
            El pulso del negocio,
            <br />
            en una sola vista.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/62">
            Una estación de trabajo precisa para sostener cada unidad, cada IMEI y cada movimiento de caja.
          </p>
        </div>

        <div className="relative max-w-md">
          <OperationalSignal
            code="01"
            title="Inventario serializado"
            detail="Disponibilidad y estado de cada equipo, sin perder trazabilidad."
          />
          <OperationalSignal
            code="02"
            title="IMEI bajo control"
            detail="Identificación operativa desde la recepción hasta la venta."
          />
          <OperationalSignal
            code="03"
            title="Caja al día"
            detail="Movimientos y cierres con el contexto financiero correcto."
          />
        </div>
      </aside>

      <main className="flex min-h-svh flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-16">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--tf-shadow-sm)]">
            <OperationsMark />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">NovaTech</p>
            <p className="mono mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Operaciones comerciales
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 items-center py-12 lg:max-w-[27rem]">
          <div className="w-full">{children}</div>
        </div>

        <footer className="flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
          <span>Acceso seguro</span>
          <span className="mono text-[0.6875rem]">NOVA / CO</span>
        </footer>
      </main>
    </div>
  );
}
