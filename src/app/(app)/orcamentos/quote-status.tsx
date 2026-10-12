import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes-schema";
import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/types/database";

const VARIANT: Record<QuoteStatus, "default" | "success" | "danger" | "neutral"> = {
  draft: "neutral",
  sent: "default",
  approved: "success",
  declined: "danger",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const variant = VARIANT[status];
  return (
    <Badge
      variant={variant === "neutral" ? "default" : variant}
      className={cn(variant === "neutral" && "bg-tinta/10 text-tinta/70")}
    >
      {QUOTE_STATUS_LABEL[status]}
    </Badge>
  );
}
