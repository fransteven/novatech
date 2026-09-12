import { describe, it, expect } from "vitest";
import { isValidLuhn, extractImeiCandidates } from "../luhn";

describe("Luhn Algorithm & IMEI Extraction", () => {
  // Real standard test IMEIs with known Luhn check digit
  // 352099001761482 is a valid Luhn 15-digit number
  // Let's verify:
  // 3 5 2 0 9 9 0 0 1 7 6 1 4 8 2
  // Double odds from right:
  // 2 (no), 8*2=16->7, 4 (no), 1*2=2, 6 (no), 7*2=14->5, 1 (no), 0*2=0, 0 (no), 9*2=18->9, 9 (no), 0*2=0, 2 (no), 5*2=10->1, 3 (no)
  // Sum: 3 + 1 + 2 + 0 + 9 + 9 + 0 + 0 + 1 + 5 + 6 + 2 + 4 + 7 + 2 = 51 -> not 0 mod 10.
  // Let's compute a valid 15-digit Luhn:
  // 490154203237518
  // 8 + (1*2=2) + 5 + (7*2=14->5) + 3 + (2*2=4) + 3 + (0*2=0) + 2 + (4*2=8) + 5 + (1*2=2) + 0 + (9*2=18->9) + 4
  // = 8+2+5+5+3+4+3+0+2+8+5+2+0+9+4 = 60. 60 % 10 === 0 -> Valid!

  const VALID_IMEI = "490154203237518";
  const INVALID_IMEI = "490154203237519";

  it("should correctly validate valid Luhn numbers", () => {
    expect(isValidLuhn(VALID_IMEI)).toBe(true);
  });

  it("should reject invalid Luhn numbers", () => {
    expect(isValidLuhn(INVALID_IMEI)).toBe(false);
  });

  it("should reject too short or non-numeric inputs", () => {
    expect(isValidLuhn("")).toBe(false);
    expect(isValidLuhn("1")).toBe(false);
    expect(isValidLuhn("abcdef")).toBe(false);
  });

  it("should extract 15-digit candidates from plain text", () => {
    const text = `Equipment specs:
IMEI: ${VALID_IMEI}
Serial: ABC12345`;
    const candidates = extractImeiCandidates(text);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].imei).toBe(VALID_IMEI);
    expect(candidates[0].isValidLuhn).toBe(true);
  });

  it("should extract 15-digit candidate from spaced or hyphenated text", () => {
    const spaced = "352 099 00 176148 2";
    const candidates = extractImeiCandidates(`IMEI 1: ${spaced}`);
    expect(candidates.some((c) => c.imei === "352099001761482")).toBe(true);
  });

  it("should prioritize candidates with valid Luhn checksum first", () => {
    const text = `Found two candidates: ${INVALID_IMEI} and ${VALID_IMEI}`;
    const candidates = extractImeiCandidates(text);
    expect(candidates.length).toBe(2);
    expect(candidates[0].imei).toBe(VALID_IMEI);
    expect(candidates[0].isValidLuhn).toBe(true);
    expect(candidates[1].imei).toBe(INVALID_IMEI);
    expect(candidates[1].isValidLuhn).toBe(false);
  });

  it("should deduplicate multiple occurrences of the same candidate", () => {
    const text = `IMEI: ${VALID_IMEI}
Reprint IMEI: ${VALID_IMEI}`;
    const candidates = extractImeiCandidates(text);
    expect(candidates.length).toBe(1);
    expect(candidates[0].imei).toBe(VALID_IMEI);
  });
});
