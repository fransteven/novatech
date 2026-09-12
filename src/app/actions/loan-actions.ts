"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createLoan,
  registerLoanPayment,
  getLoans,
  getLoanDetail,
  writeOffLoan,
  cancelLoan,
  type GetLoansFilter,
} from "@/services/loan-service";
import {
  createLoanSchema,
  registerLoanPaymentSchema,
  writeOffLoanSchema,
} from "@/lib/validators/loan-validator";

const REVALIDATE_PATHS = ["/prestamos", "/cash", "/dashboard", "/profits"];
const revalidateAll = () => REVALIDATE_PATHS.forEach((p) => revalidatePath(p));

export async function getLoansAction(filter?: GetLoansFilter) {
  try {
    const data = await getLoans(filter);
    return { success: true, data };
  } catch (error) {
    console.error("Error al obtener préstamos:", error);
    return { success: false, error: "Error al cargar la lista de préstamos" };
  }
}

export async function getLoanDetailAction(loanId: string) {
  try {
    const data = await getLoanDetail(loanId);
    if (!data) return { success: false, error: "Préstamo no encontrado" };
    return { success: true, data };
  } catch (error) {
    console.error("Error al obtener detalle del préstamo:", error);
    return { success: false, error: "Error al cargar los detalles del préstamo" };
  }
}

export async function createLoanAction(data: unknown) {
  const validation = createLoanSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    const result = await createLoan(validation.data, userId);
    revalidateAll();
    return { success: true, data: result.loan, duplicate: result.duplicate };
  } catch (error) {
    console.error("Error al crear préstamo:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Error al desembolsar el préstamo." };
  }
}

export async function registerLoanPaymentAction(data: unknown) {
  const validation = registerLoanPaymentSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    const result = await registerLoanPayment({
      ...validation.data,
      userId,
    });

    revalidateAll();
    return { success: true, duplicate: result.duplicate };
  } catch (error) {
    console.error("Error al registrar pago de préstamo:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Error al procesar el pago." };
  }
}

export async function writeOffLoanAction(data: unknown) {
  const validation = writeOffLoanSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    const userName = session?.user?.name;

    if (!userId) {
      return { success: false, error: "No autorizado: sesión requerida" };
    }

    const result = await writeOffLoan(
      validation.data.loanId,
      validation.data.reason,
      userId,
      userName
    );

    revalidateAll();
    return { success: true, writeOffAmount: result.writeOffAmount };
  } catch (error) {
    console.error("Error al castigar préstamo:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Error al castigar el préstamo." };
  }
}

export async function cancelLoanAction(loanId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, error: "No autorizado: sesión requerida" };
    }

    await cancelLoan(loanId, userId);
    revalidateAll();
    return { success: true };
  } catch (error) {
    console.error("Error al cancelar préstamo:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Error al cancelar el préstamo." };
  }
}
