import { describe, it, expect, vi, afterEach } from "vitest";
import { BarcodeAdapter, TARGET_FORMATS } from "../barcode-adapter";

describe("BarcodeAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should declare all 7 required barcode and QR formats", () => {
    expect(TARGET_FORMATS).toEqual([
      "ean_13",
      "ean_8",
      "upc_a",
      "upc_e",
      "code_128",
      "code_39",
      "qr_code",
    ]);
  });

  it("should recognize when native BarcodeDetector supports all formats", async () => {
    const mockGetSupported = vi.fn().mockResolvedValue([...TARGET_FORMATS]);
    vi.stubGlobal("window", {
      BarcodeDetector: {
        getSupportedFormats: mockGetSupported,
      },
    });

    const isNative = await BarcodeAdapter.isNativeSupported();
    expect(isNative).toBe(true);
    expect(mockGetSupported).toHaveBeenCalled();
  });

  it("should return false if native BarcodeDetector is missing some formats", async () => {
    const mockGetSupported = vi.fn().mockResolvedValue(["qr_code"]); // only QR
    vi.stubGlobal("window", {
      BarcodeDetector: {
        getSupportedFormats: mockGetSupported,
      },
    });

    const isNative = await BarcodeAdapter.isNativeSupported();
    expect(isNative).toBe(false);
  });

  it("should detect barcode and apply duplicate cooldown", async () => {
    const mockDetect = vi.fn().mockResolvedValue([
      { rawValue: "7701234567890", format: "ean_13" },
    ]);

    const adapter = new BarcodeAdapter({ duplicateCooldownMs: 1000 });
    // Mock getDetector directly
    vi.spyOn(adapter, "getDetector").mockResolvedValue({
      detect: mockDetect,
    });

    const mockVideo = {
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720,
    } as unknown as HTMLVideoElement;

    // First scan should succeed
    const firstResult = await adapter.detectFrame(mockVideo);
    expect(firstResult).not.toBeNull();
    expect(firstResult?.rawValue).toBe("7701234567890");

    // Immediate second scan of same value should be throttled by cooldown
    const secondResult = await adapter.detectFrame(mockVideo);
    expect(secondResult).toBeNull();

    // After resetting history, should detect again
    adapter.resetHistory();
    const thirdResult = await adapter.detectFrame(mockVideo);
    expect(thirdResult?.rawValue).toBe("7701234567890");
  });
});
