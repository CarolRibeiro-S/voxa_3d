"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface IntegerInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode"
  > {
  // null significa campo vazio.
  value: number | null;
  onValueChange: (value: number | null) => void;
  maxDigits?: number;
  suffix?: string;
  invalid?: boolean;
}

export const IntegerInput = forwardRef<HTMLInputElement, IntegerInputProps>(
  (
    {
      value,
      onValueChange,
      maxDigits = 6,
      suffix,
      invalid,
      className,
      onFocus,
      onClick,
      ...props
    },
    ref,
  ) => (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        invalid={invalid}
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits.length > maxDigits) return;
          onValueChange(digits === "" ? null : Number(digits));
        }}
        onFocus={(e) => {
          const input = e.currentTarget;
          requestAnimationFrame(() => input.select());
          onFocus?.(e);
        }}
        onClick={(e) => {
          e.currentTarget.select();
          onClick?.(e);
        }}
        className={cn("min-h-11", suffix ? "pr-12" : "", className)}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-tinta/50">
          {suffix}
        </span>
      )}
    </div>
  ),
);
IntegerInput.displayName = "IntegerInput";
