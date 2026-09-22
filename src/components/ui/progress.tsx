import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const progressVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      cyan: "bg-accent",
      gradient:
        "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Progress({
  className,
  value = 0,
  variant,
  indicatorClassName,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof progressVariants> & {
    value?: number;
    indicatorClassName?: string;
  }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className={cn(progressVariants({ variant }), indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
