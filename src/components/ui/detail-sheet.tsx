import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DetailSheetProps extends React.ComponentProps<typeof Sheet> {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
  wide?: boolean;
}

const DetailSheet = ({
  title,
  description,
  children,
  footer,
  contentClassName,
  bodyClassName,
  wide = false,
  ...props
}: DetailSheetProps) => (
  <Sheet {...props}>
    <SheetContent
      side="right"
      size={wide ? "wide" : "default"}
      className={contentClassName}
    >
      <SheetHeader className="tf-chrome shrink-0 border-b border-border">
        <div className="tf-trace-rail pl-3">
          <p className="mono text-[10px] font-semibold tracking-[0.12em] text-[color:var(--tf-fg-subtle)]">INSPECCIÓN</p>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </div>
      </SheetHeader>
      <div className={cn("min-h-0 flex-1 overflow-y-auto bg-card", bodyClassName)}>{children}</div>
      {footer ? <SheetFooter className="tf-chrome shrink-0 border-t border-border">{footer}</SheetFooter> : null}
    </SheetContent>
  </Sheet>
);

export { DetailSheet };
