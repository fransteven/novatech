export type ScanDecision =
  | { status: "accepted"; complete?: boolean }
  | { status: "rejected"; message: string };

export interface CameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => ScanDecision | void;
  mode?: "single" | "continuous";
  enableImeiOcr?: boolean;
  title?: string;
  description?: string;
}
