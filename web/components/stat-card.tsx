import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardColor = "primary" | "info" | "success" | "warning" | "danger";

const ICON_CLASSES: Record<StatCardColor, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const BORDER_CLASSES: Record<StatCardColor, string> = {
  primary: "border-t-primary",
  info: "border-t-sky-500",
  success: "border-t-emerald-500",
  warning: "border-t-amber-500",
  danger: "border-t-rose-500",
};

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  color = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon: LucideIcon;
  color?: StatCardColor;
  className?: string;
}) {
  return (
    <Card className={cn("gap-3 border-t-4", BORDER_CLASSES[color], className)}>
      <CardContent className="flex items-center gap-2.5 px-3 py-1 sm:gap-4 sm:px-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11",
            ICON_CLASSES[color],
          )}
        >
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          <span className="truncate text-lg font-semibold tabular-nums sm:text-2xl">{value}</span>
          {description && <span className="truncate text-xs text-muted-foreground">{description}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
