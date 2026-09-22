import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = {
  default:
    "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
  outline: "text-foreground",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
};

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
        "[&>svg]:size-3 [&>svg]:pointer-events-none",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
