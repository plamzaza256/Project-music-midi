"use client";

import {
  AlertCircle,
  X,
  CheckCircle2,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "info" | "success" | "warning" | "destructive";

const variantClasses: Record<AlertVariant, string> = {
  default: "text-foreground",
  info: "text-accent [&>svg]:text-accent [&>a]:text-accent",
  success:
    "text-emerald-400 [&>svg]:text-emerald-400 [&>a]:text-emerald-400",
  warning: "text-amber-400 [&>svg]:text-amber-400 [&>a]:text-amber-400",
  destructive:
    "text-destructive [&>svg]:text-destructive [&>a]:text-destructive",
};

const iconMap: Record<AlertVariant, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    variant?: AlertVariant;
    icon?: LucideIcon;
    onDismiss?: () => void;
  }
>(({ className, title, variant = "default", icon, onDismiss, children, ...props }, ref) => {
  const Icon = icon ?? iconMap[variant];
  return (
    <div
      ref={ref}
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "relative w-full rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      )}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1 [&>p:last-child]:mb-0">
          {title && <div className="mb-1 font-semibold">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
});
Alert.displayName = "Alert";

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
