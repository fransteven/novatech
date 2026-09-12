/**
 * Barcode and QR Code recognition adapter for NovaTech.
 *
 * Checks native BarcodeDetector API for supported formats;
 * falls back to loading the WASM polyfill (barcode-detector) on-demand.
 *
 * Formats: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code.
 */

export const TARGET_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
] as const;

export type TargetFormat = (typeof TARGET_FORMATS)[number];

export interface RecognizedCode {
  rawValue: string;
  format: string;
  timestamp: number;
}

export interface BarcodeDetectorInstance {
  detect(
    image: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement
  ): Promise<Array<{ rawValue: string; format: string }>>;
}

export class BarcodeAdapter {
  private detectorPromise: Promise<BarcodeDetectorInstance> | null = null;
  private isProcessing = false;
  private lastDetectedValue: string | null = null;
  private lastDetectedTime = 0;
  private duplicateCooldownMs: number;

  constructor(options?: { duplicateCooldownMs?: number }) {
    this.duplicateCooldownMs = options?.duplicateCooldownMs ?? 1500;
  }

  /**
   * Reset duplicate detection memory.
   */
  public resetHistory(): void {
    this.lastDetectedValue = null;
    this.lastDetectedTime = 0;
  }

  /**
   * Returns whether native BarcodeDetector is available and supports all target formats.
   */
  public static async isNativeSupported(): Promise<boolean> {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      return false;
    }
    try {
      const NativeClass = (
        window as unknown as {
          BarcodeDetector: {
            getSupportedFormats: () => Promise<string[]>;
          };
        }
      ).BarcodeDetector;

      if (!NativeClass || typeof NativeClass.getSupportedFormats !== "function") {
        return false;
      }

      const supported = await NativeClass.getSupportedFormats();
      return TARGET_FORMATS.every((format) => supported.includes(format));
    } catch {
      return false;
    }
  }

  /**
   * Initializes or reuses the detector instance (native or WASM ponyfill).
   */
  public async getDetector(): Promise<BarcodeDetectorInstance> {
    if (!this.detectorPromise) {
      this.detectorPromise = (async () => {
        const hasNative = await BarcodeAdapter.isNativeSupported();
        if (hasNative) {
          const NativeClass = (
            window as unknown as {
              BarcodeDetector: new (opts: { formats: readonly string[] }) => BarcodeDetectorInstance;
            }
          ).BarcodeDetector;
          return new NativeClass({ formats: TARGET_FORMATS });
        }

        // On-demand dynamic ponyfill load
        const { BarcodeDetector: PolyfillClass } = await import("barcode-detector/pure");
        type PolyfillOptions = ConstructorParameters<typeof PolyfillClass>[0];
        return new PolyfillClass({
          formats: TARGET_FORMATS as unknown as NonNullable<PolyfillOptions>["formats"],
        }) as unknown as BarcodeDetectorInstance;
      })();
    }
    return this.detectorPromise;
  }

  /**
   * Process a single video or canvas frame.
   * Throttled so only one frame runs at a time.
   */
  public async detectFrame(
    source: HTMLVideoElement | HTMLCanvasElement
  ): Promise<RecognizedCode | null> {
    if (this.isProcessing) {
      return null;
    }

    // Video must have ready dimensions
    const isVideo =
      (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) ||
      (source && typeof source === "object" && "videoWidth" in source);
    if (isVideo) {
      const video = source as HTMLVideoElement;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }
    }

    this.isProcessing = true;
    try {
      const detector = await this.getDetector();
      const results = await detector.detect(source);

      if (!results || results.length === 0) {
        return null;
      }

      const now = Date.now();
      for (const item of results) {
        const raw = item.rawValue?.trim();
        if (!raw) continue;

        // Check duplicate cooldown
        if (
          raw === this.lastDetectedValue &&
          now - this.lastDetectedTime < this.duplicateCooldownMs
        ) {
          continue;
        }

        this.lastDetectedValue = raw;
        this.lastDetectedTime = now;

        return {
          rawValue: raw,
          format: item.format,
          timestamp: now,
        };
      }

      return null;
    } catch {
      return null;
    } finally {
      this.isProcessing = false;
    }
  }
}
