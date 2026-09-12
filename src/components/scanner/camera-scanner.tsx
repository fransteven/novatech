"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  cameraManager,
  classifyCameraError,
} from "@/lib/camera/camera-manager";
import { BarcodeAdapter } from "@/lib/camera/barcode-adapter";
import { OcrAdapter, cropAndEnhanceFrame } from "@/lib/camera/ocr-adapter";
import { soundFeedback } from "@/lib/camera/sound-effects";
import type { ImeiCandidate } from "@/lib/camera/luhn";
import type { CameraScannerProps, ScanDecision } from "./types";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";

export function CameraScanner({
  open,
  onOpenChange,
  onScan,
  mode = "single",
  enableImeiOcr = false,
  title,
  description,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeAdapterRef = useRef<BarcodeAdapter | null>(null);
  const ocrAdapterRef = useRef<OcrAdapter | null>(null);

  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Alinea el código en el recuadro");
  const [flashState, setFlashState] = useState<"idle" | "success" | "error">("idle");
  const [continuousCount, setContinuousCount] = useState(0);

  // OCR state
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrSnapshotUrl, setOcrSnapshotUrl] = useState<string | null>(null);
  const [ocrCandidates, setOcrCandidates] = useState<ImeiCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Abort controller for current open session
  const abortControllerRef = useRef<AbortController | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleResult = useCallback(
    (scannedValue: string) => {
      const decision: ScanDecision | void = onScan(scannedValue);

      if (!decision || decision.status === "accepted") {
        soundFeedback.playSuccess();
        setFlashState("success");
        setStatusMessage(`Leído: ${scannedValue}`);

        if (mode === "continuous") {
          setContinuousCount((prev) => prev + 1);
          if (decision && decision.status === "accepted" && decision.complete) {
            setTimeout(() => {
              onOpenChange(false);
            }, 500);
          } else {
            setTimeout(() => {
              setFlashState("idle");
              setStatusMessage("Listo para siguiente lectura");
            }, 1000);
          }
        } else {
          // Single mode: close scanner
          setTimeout(() => {
            onOpenChange(false);
          }, 350);
        }
      } else {
        soundFeedback.playError();
        setFlashState("error");
        setStatusMessage(decision.message || "Valor rechazado");

        setTimeout(() => {
          setFlashState("idle");
          setStatusMessage("Alinea el código en el recuadro");
        }, 1800);
      }
    },
    [mode, onOpenChange, onScan]
  );

  // Setup camera & barcode scan loop
  useEffect(() => {
    if (!open) {
      // Clean up when closed
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      cameraManager.release();
      if (ocrAdapterRef.current) {
        ocrAdapterRef.current.terminate();
        ocrAdapterRef.current = null;
      }
      setHasTorch(false);
      setTorchOn(false);
      setCameraError(null);
      setFlashState("idle");
      setContinuousCount(0);
      setOcrActive(false);
      setOcrSnapshotUrl(null);
      setOcrCandidates([]);
      setSelectedCandidate("");
      setOcrError(null);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setCameraLoading(true);
    setCameraError(null);
    setStatusMessage("Iniciando cámara...");

    barcodeAdapterRef.current = new BarcodeAdapter({ duplicateCooldownMs: 1500 });

    async function initCamera() {
      try {
        const stream = await cameraManager.requestCamera({
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setHasTorch(cameraManager.hasTorch());
        setTorchOn(cameraManager.isTorchOn);
        setCameraLoading(false);
        setStatusMessage("Alinea el código en el recuadro");

        // Start scanning loop
        const loop = async () => {
          if (abortController.signal.aborted) return;

          // Only scan if not doing OCR review
          if (videoRef.current && !ocrActive && !ocrProcessing) {
            const detected = await barcodeAdapterRef.current?.detectFrame(videoRef.current);
            if (detected && detected.rawValue) {
              handleResult(detected.rawValue);
            }
          }

          animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (abortController.signal.aborted) return;
        setCameraLoading(false);
        const typed = classifyCameraError(err);
        setCameraError(typed.message);
        setStatusMessage(typed.message);
      }
    }

    initCamera();

    return () => {
      abortController.abort();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      cameraManager.release();
      if (ocrAdapterRef.current) {
        ocrAdapterRef.current.terminate();
        ocrAdapterRef.current = null;
      }
    };
  }, [open, ocrActive, ocrProcessing, handleResult]);

  const toggleTorch = async () => {
    const nextState = !torchOn;
    const ok = await cameraManager.setTorch(nextState);
    if (ok) {
      setTorchOn(nextState);
    }
  };

  const handleStartOcr = async () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return;

    setOcrProcessing(true);
    setOcrError(null);
    setStatusMessage("Procesando imagen con OCR...");

    try {
      const croppedCanvas = cropAndEnhanceFrame(videoRef.current);
      const snapshotUrl = croppedCanvas.toDataURL("image/jpeg", 0.9);
      setOcrSnapshotUrl(snapshotUrl);

      if (!ocrAdapterRef.current) {
        ocrAdapterRef.current = new OcrAdapter();
      }

      const result = await ocrAdapterRef.current.recognize(croppedCanvas);
      setOcrCandidates(result.candidates);

      if (result.candidates.length > 0) {
        setSelectedCandidate(result.candidates[0].imei);
        setStatusMessage(`${result.candidates.length} candidato(s) encontrado(s)`);
      } else {
        setSelectedCandidate("");
        setOcrError("No se detectó un IMEI de 15 dígitos. Puedes escribirlo o reintentar.");
        setStatusMessage("No se detectó IMEI de 15 dígitos");
      }

      setOcrActive(true);
    } catch {
      setOcrError("Error al procesar el texto. Por favor reintente.");
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleConfirmOcr = () => {
    const clean = selectedCandidate.trim();
    if (!clean) return;
    setOcrActive(false);
    setOcrSnapshotUrl(null);
    setOcrCandidates([]);
    setSelectedCandidate("");
    handleResult(clean);
  };

  const handleCancelOcr = () => {
    setOcrActive(false);
    setOcrSnapshotUrl(null);
    setOcrCandidates([]);
    setSelectedCandidate("");
    setOcrError(null);
    setStatusMessage("Alinea el código en el recuadro");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md w-[95vw] p-0 overflow-hidden bg-card border-border rounded-2xl flex flex-col max-h-[92vh]"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Camera className="h-4 w-4 text-[color:var(--tf-accent)]" />
              {title || (mode === "continuous" ? "Escaneo Continuo" : "Escanear Código / IMEI")}
              {mode === "continuous" && (
                <Badge variant="outline" className="text-[11px] font-mono font-semibold ml-1">
                  {continuousCount} leídos
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {description || (enableImeiOcr ? "Códigos de barra, QR y OCR de IMEI" : "Códigos de barra y QR")}
            </DialogDescription>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar escáner"
            className="w-9 h-9 min-w-[44px] min-h-[44px] rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Viewport Area */}
        <div className="relative aspect-[4/3] sm:aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Camera Loading Overlay */}
          {cameraLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-[color:var(--tf-accent)]" />
              <p className="text-xs font-medium text-foreground">Activando cámara...</p>
            </div>
          )}

          {/* Camera Error Overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-background/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-20">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-semibold text-foreground">{cameraError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 min-h-[44px]"
                onClick={() => {
                  setCameraError(null);
                  setCameraLoading(true);
                  cameraManager.requestCamera().then((s) => {
                    if (videoRef.current) {
                      videoRef.current.srcObject = s;
                      videoRef.current.play();
                    }
                    setCameraLoading(false);
                  }).catch((e) => {
                    setCameraError(classifyCameraError(e).message);
                    setCameraLoading(false);
                  });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          )}

          {/* Viewfinder Reticle Overlay (Active when NOT in OCR confirmation) */}
          {!ocrActive && !cameraLoading && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div
                className={`relative w-[82%] aspect-[2.4/1] rounded-xl border-2 transition-all duration-200 ${
                  flashState === "success"
                    ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.7)]"
                    : flashState === "error"
                      ? "border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.7)]"
                      : "border-[color:var(--tf-accent)] shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                }`}
              >
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white rounded-br-sm" />

                {/* Animated scan beam */}
                {flashState === "idle" && !ocrProcessing && (
                  <div
                    className="absolute inset-x-0 h-0.5 bg-[color:var(--tf-accent)] shadow-[0_0_8px_var(--tf-accent)] animate-pulse"
                    style={{
                      animation: "scanBeam 2.2s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* OCR Review Sub-View (Overlaid onto video when OCR captures) */}
          {ocrActive && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-30 p-4 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Verificación de IMEI (OCR)
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Confirmación humana
                  </Badge>
                </div>

                {ocrSnapshotUrl && (
                  <div className="rounded-lg overflow-hidden border border-border bg-black/40 max-h-[85px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ocrSnapshotUrl}
                      alt="Recorte capturado"
                      className="w-full h-auto max-h-[85px] object-contain"
                    />
                  </div>
                )}

                {ocrCandidates.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">
                      Candidatos detectados:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ocrCandidates.map((c) => (
                        <button
                          key={c.imei}
                          type="button"
                          onClick={() => setSelectedCandidate(c.imei)}
                          className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                            selectedCandidate === c.imei
                              ? "bg-primary text-primary-foreground border-primary font-bold"
                              : "bg-muted hover:bg-muted/80 text-foreground border-border"
                          }`}
                        >
                          {c.imei}
                          {c.isValidLuhn ? (
                            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] py-0 px-1 border-0">
                              Luhn OK
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1">
                              15 dígitos
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  ocrError && (
                    <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      {ocrError}
                    </div>
                  )
                )}

                <div className="space-y-1">
                  <label htmlFor="imei-edit" className="text-xs font-semibold text-muted-foreground">
                    IMEI a utilizar (puedes editarlo si hubo error):
                  </label>
                  <Input
                    id="imei-edit"
                    value={selectedCandidate}
                    onChange={(e) => setSelectedCandidate(e.target.value)}
                    placeholder="15 dígitos de IMEI"
                    className="font-mono text-sm tracking-wider"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelOcr}
                  className="flex-1 min-h-[44px] cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Reintentar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmOcr}
                  disabled={!selectedCandidate.trim()}
                  className="flex-1 min-h-[44px] bg-primary text-primary-foreground font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Confirmar IMEI
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Live Controls */}
        <div className="p-3 bg-card border-t border-border flex items-center justify-between gap-2">
          {/* Status announcement pill */}
          <div className="flex-1 min-w-0 pr-2">
            <p
              aria-live="polite"
              className={`text-xs truncate font-medium ${
                flashState === "success"
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : flashState === "error"
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : "text-muted-foreground"
              }`}
            >
              {statusMessage}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight button */}
            {hasTorch && (
              <Button
                variant={torchOn ? "default" : "outline"}
                size="sm"
                onClick={toggleTorch}
                aria-label={torchOn ? "Apagar linterna" : "Encender linterna"}
                className="w-11 h-11 min-w-[44px] min-h-[44px] p-0 rounded-xl cursor-pointer"
              >
                {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
              </Button>
            )}

            {/* OCR capture button (only in IMEI-enabled contexts) */}
            {enableImeiOcr && !ocrActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartOcr}
                disabled={cameraLoading || Boolean(cameraError) || ocrProcessing}
                className="min-h-[44px] px-3 gap-1.5 font-semibold text-xs rounded-xl cursor-pointer"
              >
                {ocrProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-[color:var(--tf-accent)]" />
                )}
                <span>Leer IMEI (OCR)</span>
              </Button>
            )}
          </div>
        </div>

        <style jsx global>{`
          @keyframes scanBeam {
            0% {
              top: 8%;
              opacity: 0.3;
            }
            50% {
              top: 88%;
              opacity: 0.9;
            }
            100% {
              top: 8%;
              opacity: 0.3;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
