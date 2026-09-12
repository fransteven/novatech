/**
 * OCR Adapter for localized IMEI recognition using Tesseract.js.
 *
 * Provides:
 * - ROI cropping of the central camera region.
 * - Canvas image enhancement (grayscale, contrast stretching).
 * - Lazy loading of Tesseract worker, reusing across captures in a session.
 * - Extraction and Luhn ranking of 15-digit IMEI candidates.
 * - Thorough termination and cleanup.
 */

import { extractImeiCandidates, type ImeiCandidate } from "./luhn";

export interface OcrRecognitionResult {
  rawText: string;
  candidates: ImeiCandidate[];
  canvasDataUrl: string;
}

/**
 * Crops the central region of interest (ROI) from the video element,
 * scales it up, and applies grayscale & contrast enhancement.
 */
export function cropAndEnhanceFrame(
  video: HTMLVideoElement,
  roiRect?: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Default central ROI (75% width, 35% height in middle)
  const defaultWidth = vw * 0.75;
  const defaultHeight = vh * 0.35;
  const sx = roiRect?.x ?? (vw - defaultWidth) / 2;
  const sy = roiRect?.y ?? (vh - defaultHeight) / 2;
  const sw = roiRect?.width ?? defaultWidth;
  const sh = roiRect?.height ?? defaultHeight;

  // 2x scale for higher character definition in OCR
  const scale = 2;
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  canvas.width = dw;
  canvas.height = dh;

  // Draw scaled crop
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);

  // Apply contrast enhancement on pixel data
  try {
    const imgData = ctx.getImageData(0, 0, dw, dh);
    const data = imgData.data;

    let min = 255;
    let max = 0;

    // First pass: find luminance range
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (gray < min) min = gray;
      if (gray > max) max = gray;
    }

    // Contrast stretch
    const range = max - min || 1;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const stretched = Math.min(255, Math.max(0, Math.round(((gray - min) * 255) / range)));

      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // If getImageData fails due to any canvas restriction, continue with base crop
  }

  return canvas;
}

export class OcrAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private worker: any = null;
  private isInitializing = false;

  /**
   * Initializes or returns the cached Tesseract worker.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getWorker(): Promise<any> {
    if (this.worker) return this.worker;

    this.isInitializing = true;
    try {
      const { createWorker } = await import("tesseract.js");
      // Load English model (standard Latin digits)
      const worker = await createWorker("eng");
      this.worker = worker;
      return worker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Recognizes text on a processed canvas and extracts 15-digit IMEI candidates.
   */
  public async recognize(canvas: HTMLCanvasElement): Promise<OcrRecognitionResult> {
    const worker = await this.getWorker();
    this.worker = worker;
    const result = await worker.recognize(canvas);
    const rawText = result?.data?.text || "";
    const candidates = extractImeiCandidates(rawText);
    const canvasDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    return {
      rawText,
      candidates,
      canvasDataUrl,
    };
  }

  /**
   * Terminate worker and release web worker memory.
   */
  public async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        // Ignore error on shutdown
      }
      this.worker = null;
    }
    this.isInitializing = false;
  }
}
