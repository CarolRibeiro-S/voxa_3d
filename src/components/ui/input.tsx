import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-white px-4 text-sm text-tinta shadow-sm outline-none transition placeholder:text-tinta/40 focus:border-violeta focus:ring-2 focus:ring-violeta/20",
        invalid ? "border-red-500" : "border-violeta/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
