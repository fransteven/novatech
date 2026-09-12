import { describe, it, expect, vi, afterEach } from "vitest";
import { OcrAdapter } from "../ocr-adapter";

describe("OcrAdapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should recognize text and return parsed IMEI candidates", async () => {
    const VALID_IMEI = "490154203237518";
    const mockWorker = {
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: `DEVICE DETAILS\nIMEI: ${VALID_IMEI}\nS/N: ABC123XYZ`,
        },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    };

    const adapter = new OcrAdapter();
    vi.spyOn(adapter, "getWorker").mockResolvedValue(mockWorker);

    // Mock canvas
    const mockCanvas = {
      toDataURL: vi.fn().mockReturnValue("data:image/jpeg;base64,mock"),
    } as unknown as HTMLCanvasElement;

    const result = await adapter.recognize(mockCanvas);
    expect(result.rawText).toContain(VALID_IMEI);
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].imei).toBe(VALID_IMEI);
    expect(result.candidates[0].isValidLuhn).toBe(true);

    await adapter.terminate();
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
