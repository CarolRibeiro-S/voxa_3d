import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-white border border-violeta/10",
  dark: "bg-tinta text-white",
} as const;

export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants }) {
  return (
    <div
      className={cn("rounded-xl p-6 shadow-sm", variants[variant], className)}
      {...props}
    />
  );
}
