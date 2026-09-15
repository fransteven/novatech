import * as React from "react";

import { cn } from "@/lib/utils";

const DataToolbar = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="data-toolbar"
    className={cn(
      "flex min-h-11 flex-wrap items-center gap-2 border border-border bg-card px-3 py-2 sm:px-4",
      className,
    )}
    {...props}
  />
);

export { DataToolbar };
