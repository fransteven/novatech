/**
 * Central Camera Manager for NovaTech.
 *
 * Provides:
 * - Mutual exclusion across camera acquisitions.
 * - Resolution and facingMode fallback cascade (ideal 720p environment -> environment -> any).
 * - Logical cancellation via AbortSignal.
 * - Thorough resource cleanup (tracks, video element, torch).
 * - Strongly-typed camera errors with user-actionable messages.
 */

export type CameraErrorCode =
  | "NOT_SUPPORTED"
  | "NOT_SECURE_CONTEXT"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "DEVICE_IN_USE"
  | "OVERCONSTRAINED"
  | "ABORTED"
  | "BUSY"
  | "UNKNOWN_ERROR";

export class CameraError extends Error {
  constructor(
    public readonly code: CameraErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "CameraError";
  }
}

export function isCameraSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(navigator?.mediaDevices?.getUserMedia);
}

export function classifyCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return new CameraError(
      "NOT_SECURE_CONTEXT",
      "El acceso a la cámara requiere una conexión segura (HTTPS o localhost).",
      error
    );
  }

  const err = error as { name?: string; message?: string };
  const name = err?.name || "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return new CameraError(
        "PERMISSION_DENIED",
        "Permiso denegado para acceder a la cámara. Por favor permítelo en los ajustes de tu navegador.",
        error
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new CameraError(
        "NOT_FOUND",
        "No se encontró ninguna cámara disponible en este dispositivo.",
        error
      );
    case "NotReadableError":
    case "TrackStartError":
      return new CameraError(
        "DEVICE_IN_USE",
        "La cámara está siendo utilizada por otra aplicación o pestaña del navegador.",
        error
      );
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return new CameraError(
        "OVERCONSTRAINED",
        "La cámara no soporta la resolución o modo solicitado.",
        error
      );
    case "AbortError":
      return new CameraError(
        "ABORTED",
        "La apertura de la cámara fue cancelada.",
        error
      );
    default:
      return new CameraError(
        "UNKNOWN_ERROR",
        err?.message || "Ocurrió un error inesperado al inicializar la cámara.",
        error
      );
  }
}

interface RequestCameraOptions {
  signal?: AbortSignal;
}

const FALLBACK_CONSTRAINTS: MediaStreamConstraints[] = [
  // 1. Prefer rear camera at 720p
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  },
  // 2. Relaxed facing mode environment
  {
    video: {
      facingMode: "environment",
    },
    audio: false,
  },
  // 3. Any video source
  {
    video: true,
    audio: false,
  },
];

class CameraManagerSingleton {
  private activeStream: MediaStream | null = null;
  private isAcquiring = false;
  private torchEnabled = false;

  public get isStreaming(): boolean {
    return Boolean(this.activeStream && this.activeStream.active);
  }

  public get stream(): MediaStream | null {
    return this.activeStream;
  }

  public get isTorchOn(): boolean {
    return this.torchEnabled;
  }

  /**
   * Check if the currently active video track supports torch/flashlight.
   */
  public hasTorch(): boolean {
    if (!this.activeStream) return false;
    const track = this.activeStream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function") return false;
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    return Boolean(capabilities.torch);
  }

  /**
   * Turn torch on or off.
   */
  public async setTorch(enabled: boolean): Promise<boolean> {
    if (!this.hasTorch() || !this.activeStream) return false;
    const track = this.activeStream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as MediaTrackConstraintSet & { torch: boolean }],
      });
      this.torchEnabled = enabled;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request camera stream with mutual exclusion and fallback cascade.
   */
  public async requestCamera(options?: RequestCameraOptions): Promise<MediaStream> {
    const signal = options?.signal;

    if (signal?.aborted) {
      throw new CameraError("ABORTED", "La solicitud fue cancelada antes de iniciar.");
    }

    if (this.isAcquiring) {
      throw new CameraError("BUSY", "Ya hay una solicitud de cámara en curso.");
    }

    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      throw new CameraError("NOT_SUPPORTED", "Este navegador no soporta captura de cámara.");
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      throw new CameraError("NOT_SECURE_CONTEXT", "El acceso a la cámara requiere HTTPS o localhost.");
    }

    // Stop existing stream if any
    this.release();

    this.isAcquiring = true;
    let lastError: unknown = null;
    let acquiredStream: MediaStream | null = null;

    try {
      for (const constraints of FALLBACK_CONSTRAINTS) {
        if (signal?.aborted) {
          throw new CameraError("ABORTED", "La solicitud de cámara fue cancelada.");
        }

        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (acquiredStream) break;
        } catch (err) {
          lastError = err;
          const typed = classifyCameraError(err);
          // If permission was explicitly denied, no need to retry with other constraints
          if (typed.code === "PERMISSION_DENIED") {
            throw typed;
          }
          // Continue to next fallback
        }
      }

      if (!acquiredStream) {
        throw classifyCameraError(lastError);
      }

      // Check if aborted while getUserMedia was resolving
      if (signal?.aborted) {
        acquiredStream.getTracks().forEach((t) => t.stop());
        throw new CameraError("ABORTED", "La apertura de la cámara fue cancelada.");
      }

      this.activeStream = acquiredStream;
      this.torchEnabled = false;

      // Handle stream end externally (e.g. OS permissions revoked or device unplugged)
      const videoTrack = acquiredStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          this.release();
        });
      }

      return acquiredStream;
    } finally {
      this.isAcquiring = false;
    }
  }

  /**
   * Release camera tracks, reset torch, and disconnect stream.
   */
  public release(): void {
    if (this.activeStream) {
      // First turn off torch if enabled
      if (this.torchEnabled) {
        const track = this.activeStream.getVideoTracks()[0];
        if (track && typeof track.applyConstraints === "function") {
          try {
            track.applyConstraints({
              advanced: [{ torch: false } as MediaTrackConstraintSet & { torch: boolean }],
            });
          } catch {
            // Ignore error when shutting down
          }
        }
        this.torchEnabled = false;
      }

      this.activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.activeStream = null;
    }
    this.isAcquiring = false;
  }
}

export const cameraManager = new CameraManagerSingleton();
