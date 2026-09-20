import { describe, it, expect, vi } from "vitest";
import {
  formatFictitiousCustomerDoc,
  isFictitiousCustomerDoc,
  parseFictitiousCustomerDoc,
  formatFictitiousInvoiceNumber,
  isFictitiousInvoiceNumber,
  parseFictitiousInvoiceNumber,
  getNextFictitiousInvoiceNumber,
} from "../fictitious-documents";

describe("Fictitious Customer Documents", () => {
  it("should format numbers with 6-digit zero padding and FIC- prefix", () => {
    expect(formatFictitiousCustomerDoc(1)).toBe("FIC-000001");
    expect(formatFictitiousCustomerDoc(25)).toBe("FIC-000025");
    expect(formatFictitiousCustomerDoc(1000)).toBe("FIC-001000");
    expect(formatFictitiousCustomerDoc(999999)).toBe("FIC-999999");
  });

  it("should throw error on invalid consecutive", () => {
    expect(() => formatFictitiousCustomerDoc(0)).toThrow();
    expect(() => formatFictitiousCustomerDoc(-5)).toThrow();
    expect(() => formatFictitiousCustomerDoc(1.5)).toThrow();
  });

  it("should identify valid fictitious documents", () => {
    expect(isFictitiousCustomerDoc("FIC-000001")).toBe(true);
    expect(isFictitiousCustomerDoc("FIC-123456")).toBe(true);
    expect(isFictitiousCustomerDoc("fic-000042")).toBe(true); // case insensitive check
  });

  it("should reject non-fictitious or malformed documents", () => {
    expect(isFictitiousCustomerDoc(null)).toBe(false);
    expect(isFictitiousCustomerDoc(undefined)).toBe(false);
    expect(isFictitiousCustomerDoc("")).toBe(false);
    expect(isFictitiousCustomerDoc("1234567890")).toBe(false);
    expect(isFictitiousCustomerDoc("1116789432")).toBe(false);
    expect(isFictitiousCustomerDoc("FIC-1")).toBe(false);
    expect(isFictitiousCustomerDoc("FIC-0001")).toBe(false);
    expect(isFictitiousCustomerDoc("DOC-000001")).toBe(false);
  });

  it("should correctly parse consecutive numbers", () => {
    expect(parseFictitiousCustomerDoc("FIC-000001")).toBe(1);
    expect(parseFictitiousCustomerDoc("FIC-000123")).toBe(123);
    expect(parseFictitiousCustomerDoc("FIC-999999")).toBe(999999);
    expect(parseFictitiousCustomerDoc("12345678")).toBe(null);
    expect(parseFictitiousCustomerDoc(null)).toBe(null);
  });
});

describe("Fictitious Invoices", () => {
  it("should format numbers with 7-digit zero padding and FIC- prefix by default", () => {
    expect(formatFictitiousInvoiceNumber(1)).toBe("FIC-0000001");
    expect(formatFictitiousInvoiceNumber(2)).toBe("FIC-0000002");
    expect(formatFictitiousInvoiceNumber(42)).toBe("FIC-0000042");
    expect(formatFictitiousInvoiceNumber(1000)).toBe("FIC-0001000");
    expect(formatFictitiousInvoiceNumber(9999999)).toBe("FIC-9999999");
  });

  it("should throw error on invalid consecutive", () => {
    expect(() => formatFictitiousInvoiceNumber(0)).toThrow();
    expect(() => formatFictitiousInvoiceNumber(-1)).toThrow();
    expect(() => formatFictitiousInvoiceNumber(2.4)).toThrow();
  });

  it("should identify valid fictitious invoices", () => {
    expect(isFictitiousInvoiceNumber("FIC-0000001")).toBe(true);
    expect(isFictitiousInvoiceNumber("fic-0000005")).toBe(true);
    expect(isFictitiousInvoiceNumber("FAC-FIC-000001")).toBe(true);
    expect(isFictitiousInvoiceNumber("FAC-FIC-0000001")).toBe(true);
  });

  it("should reject non-fictitious or malformed invoices", () => {
    expect(isFictitiousInvoiceNumber(null)).toBe(false);
    expect(isFictitiousInvoiceNumber(undefined)).toBe(false);
    expect(isFictitiousInvoiceNumber("")).toBe(false);
    expect(isFictitiousInvoiceNumber("INV-123456")).toBe(false);
    expect(isFictitiousInvoiceNumber("114-8208459-9522641")).toBe(false);
    expect(isFictitiousInvoiceNumber("20260831901383474SRV001788186209869")).toBe(false);
  });

  it("should correctly parse consecutive numbers from invoices", () => {
    expect(parseFictitiousInvoiceNumber("FIC-0000001")).toBe(1);
    expect(parseFictitiousInvoiceNumber("FIC-0000042")).toBe(42);
    expect(parseFictitiousInvoiceNumber("FAC-FIC-000001")).toBe(1);
    expect(parseFictitiousInvoiceNumber("FAC-FIC-0000123")).toBe(123);
    expect(parseFictitiousInvoiceNumber("NON-FIC-123")).toBe(null);
  });

  it("should calculate next consecutive from database mock", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { invoiceNumber: "FIC-0000001" },
            { invoiceNumber: "FIC-0000002" },
            { invoiceNumber: "FAC-FIC-0000003" },
          ]),
        }),
      }),
    };

    const next = await getNextFictitiousInvoiceNumber(mockDb as unknown as Parameters<typeof getNextFictitiousInvoiceNumber>[0]);
    expect(next).toBe("FIC-0000004");
  });

  it("should return FIC-0000001 if no fictitious invoices exist in database", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const next = await getNextFictitiousInvoiceNumber(mockDb as unknown as Parameters<typeof getNextFictitiousInvoiceNumber>[0]);
    expect(next).toBe("FIC-0000001");
  });
});
