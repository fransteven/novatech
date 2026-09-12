"use client";

import { useState, useSyncExternalStore } from "react";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { isCameraSupported } from "@/lib/camera/camera-manager";
import type { CameraScannerProps, ScanDecision } from "./types";
import { Camera } from "lucide-react";

const emptySubscribe = () => () => {};
const getCameraSupport = () => isCameraSupported();
const getServerSnapshot = () => true;

// Lazy load CameraScanner so camera/WASM/Tesseract bundles are only loaded when opened
const CameraScanner = dynamic<CameraScannerProps>(
  () => import("./camera-scanner").then((mod) => mod.CameraScanner),
  { ssr: false }
);

export interface ScanButtonProps {
  onScan: (value: string) => ScanDecision | void;
  mode?: "single" | "continuous";
  enableImeiOcr?: boolean;
  title?: string;
  description?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
  "aria-label"?: string;
}

export function ScanButton({
  onScan,
  mode = "single",
  enableImeiOcr = false,
  title,
  description,
  variant = "outline",
  size = "icon",
  className,
  iconClassName = "h-4 w-4",
  children,
  disabled = false,
  "aria-label": ariaLabel,
}: ScanButtonProps) {
  const [open, setOpen] = useState(false);
  const supported = useSyncExternalStore(
    emptySubscribe,
    getCameraSupport,
    getServerSnapshot
  );

  if (!supported) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || title || "Abrir escáner de cámara"}
        className={`cursor-pointer ${className ?? ""}`}
      >
        {children ? (
          children
        ) : (
          <Camera className={iconClassName} />
        )}
      </Button>

      {open && (
        <CameraScanner
          open={open}
          onOpenChange={setOpen}
          onScan={onScan}
          mode={mode}
          enableImeiOcr={enableImeiOcr}
          title={title}
          description={description}
        />
      )}
    </>
  );
}
