import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyCameraError,
  cameraManager,
  CameraError,
} from "../camera-manager";

describe("Camera Manager & Error Classification", () => {
  describe("classifyCameraError", () => {
    it("should classify NotAllowedError as PERMISSION_DENIED", () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("PERMISSION_DENIED");
      expect(classified.message).toContain("Permiso denegado");
    });

    it("should classify NotFoundError as NOT_FOUND", () => {
      const err = new Error("Requested device not found");
      err.name = "NotFoundError";
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("NOT_FOUND");
      expect(classified.message).toContain("No se encontró ninguna cámara");
    });

    it("should classify NotReadableError as DEVICE_IN_USE", () => {
      const err = new Error("Hardware error");
      err.name = "NotReadableError";
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("DEVICE_IN_USE");
      expect(classified.message).toContain("utilizada por otra aplicación");
    });

    it("should classify OverconstrainedError as OVERCONSTRAINED", () => {
      const err = new Error("Constraints unsatisfied");
      err.name = "OverconstrainedError";
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("OVERCONSTRAINED");
      expect(classified.message).toContain("no soporta la resolución");
    });

    it("should classify AbortError as ABORTED", () => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("ABORTED");
    });

    it("should classify generic errors as UNKNOWN_ERROR", () => {
      const err = new Error("Something broke");
      const classified = classifyCameraError(err);
      expect(classified.code).toBe("UNKNOWN_ERROR");
      expect(classified.message).toBe("Something broke");
    });
  });

  describe("cameraManager lifecycle & fallback", () => {
    let mockGetUserMedia: ReturnType<typeof vi.fn>;
    let mockTrackStop: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockTrackStop = vi.fn();
      const mockStream = {
        active: true,
        getVideoTracks: () => [
          {
            stop: mockTrackStop,
            getCapabilities: () => ({ torch: true }),
            applyConstraints: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn(),
          },
        ],
        getTracks: () => [
          {
            stop: mockTrackStop,
          },
        ],
      };

      mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

      vi.stubGlobal("window", {
        isSecureContext: true,
        location: { hostname: "localhost" },
      });

      vi.stubGlobal("navigator", {
        mediaDevices: {
          getUserMedia: mockGetUserMedia,
        },
      });
    });

    afterEach(() => {
      cameraManager.release();
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it("should successfully request camera using primary constraints", async () => {
      const stream = await cameraManager.requestCamera();
      expect(stream).toBeDefined();
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
      expect(cameraManager.isStreaming).toBe(true);
      expect(cameraManager.hasTorch()).toBe(true);
    });

    it("should fallback to secondary and tertiary constraints if ideal fails", async () => {
      // First attempt fails with OverconstrainedError, second succeeds
      const overconstrained = new Error("720p not supported");
      overconstrained.name = "OverconstrainedError";

      mockGetUserMedia
        .mockRejectedValueOnce(overconstrained)
        .mockResolvedValueOnce({
          active: true,
          getVideoTracks: () => [{ stop: mockTrackStop, addEventListener: vi.fn() }],
          getTracks: () => [{ stop: mockTrackStop }],
        });

      const stream = await cameraManager.requestCamera();
      expect(stream).toBeDefined();
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });

    it("should abort immediately when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(cameraManager.requestCamera({ signal: controller.signal })).rejects.toThrow(
        CameraError
      );
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    it("should enforce mutual exclusion (busy error if concurrent request)", async () => {
      // Create a slow getUserMedia
      let resolveStream: (value: unknown) => void;
      mockGetUserMedia.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStream = resolve;
          })
      );

      const promise1 = cameraManager.requestCamera();
      const promise2 = cameraManager.requestCamera();

      await expect(promise2).rejects.toThrow("Ya hay una solicitud de cámara en curso");

      resolveStream!({
        active: true,
        getVideoTracks: () => [{ stop: mockTrackStop, addEventListener: vi.fn() }],
        getTracks: () => [{ stop: mockTrackStop }],
      });

      await promise1;
    });

    it("should thoroughly stop tracks and release resources on release()", async () => {
      await cameraManager.requestCamera();
      expect(cameraManager.isStreaming).toBe(true);

      cameraManager.release();
      expect(mockTrackStop).toHaveBeenCalled();
      expect(cameraManager.isStreaming).toBe(false);
      expect(cameraManager.stream).toBeNull();
    });
  });
});
