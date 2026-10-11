import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-24 w-full rounded-xl border bg-white px-4 py-3 text-sm text-tinta shadow-sm outline-none transition placeholder:text-tinta/40 focus:border-violeta focus:ring-2 focus:ring-violeta/20",
        invalid ? "border-red-500" : "border-violeta/20",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
