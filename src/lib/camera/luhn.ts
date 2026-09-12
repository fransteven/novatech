/**
 * Luhn algorithm and IMEI extraction utilities for NovaTech.
 *
 * Standard IMEI has 15 digits (14 digits + 1 check digit verified with Luhn).
 */

/**
 * Validates a number string using the Luhn algorithm (mod 10).
 */
export function isValidLuhn(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length < 2) return false;

  let sum = 0;
  let shouldDouble = false;

  // Process digits from right to left
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export interface ImeiCandidate {
  imei: string;
  isValidLuhn: boolean;
}

/**
 * Extracts potential 15-digit IMEI candidates from arbitrary OCR or raw text.
 * Prioritizes candidates with a valid Luhn checksum.
 */
export function extractImeiCandidates(text: string): ImeiCandidate[] {
  if (!text) return [];

  const candidatesSet = new Set<string>();

  // 1. Direct match: 15 consecutive digits
  const directMatches = text.match(/\b\d{15}\b/g);
  if (directMatches) {
    for (const match of directMatches) {
      candidatesSet.add(match);
    }
  }

  // 2. Line by line / token by token matching:
  // Remove spaces, hyphens, slashes, and periods between digits
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // Look for lines containing "IMEI" or similar labels
    const imeiIndex = line.search(/imei/i);
    const textToScan = imeiIndex >= 0 ? line.slice(imeiIndex) : line;

    // Find all digit-heavy sequences (digits possibly spaced by spaces, dots, or dashes)
    const spacedMatches = textToScan.match(/(?:\d[\s\-\.\/]*){14,16}\d/g);
    if (spacedMatches) {
      for (const m of spacedMatches) {
        const digitsOnly = m.replace(/\D/g, "");
        if (digitsOnly.length === 15) {
          candidatesSet.add(digitsOnly);
        } else if (digitsOnly.length > 15) {
          // If 16 digits (e.g. IMEISV), also consider the first 15 digits
          candidatesSet.add(digitsOnly.slice(0, 15));
        }
      }
    }
  }

  // 3. Fallback: scan whole text for any sequence of 15 digits
  const allDigits = text.replace(/\D/g, "");
  if (allDigits.length === 15) {
    candidatesSet.add(allDigits);
  }

  const results: ImeiCandidate[] = Array.from(candidatesSet).map((imei) => ({
    imei,
    isValidLuhn: isValidLuhn(imei),
  }));

  // Sort: valid Luhn candidates first
  results.sort((a, b) => {
    if (a.isValidLuhn === b.isValidLuhn) return 0;
    return a.isValidLuhn ? -1 : 1;
  });

  return results;
}
