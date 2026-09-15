import * as React from "react";

import { cn } from "@/lib/utils";

type PageShellWidth = "wide" | "standard" | "narrow" | "workspace";

interface PageShellProps extends React.ComponentProps<"div"> {
  width?: PageShellWidth;
}

const PageShell = ({ className, width = "wide", ...props }: PageShellProps) => (
  <div
    data-slot="page-shell"
    data-width={width}
    className={cn("tf-page-shell", className)}
    {...props}
  />
);

export { PageShell };
