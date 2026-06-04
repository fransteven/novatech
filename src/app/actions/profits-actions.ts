"use server";

import * as profitsService from "@/services/profits-service";
import { parseISO, startOfMonth, endOfMonth } from "date-fns";

function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  try {
    return {
      from: from ? parseISO(from) : startOfMonth(now),
      to: to ? parseISO(to) : endOfMonth(now),
    };
  } catch {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

export async function getProfitsDataAction(from?: string, to?: string) {
  try {
    const range = parseDateRange(from, to);
    const kpis = await profitsService.getProfitsKPIs(range);
    return { success: true, data: { kpis } };
  } catch (error) {
    console.error("Error fetching profits data:", error);
    return { success: false, error: "Failed to fetch profits data" };
  }
}

export async function getMonthlyProfitsAction(year: number) {
  try {
    const data = await profitsService.getMonthlyProfits(year);
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching monthly profits:", error);
    return { success: false, error: "Failed to fetch monthly profits" };
  }
}
