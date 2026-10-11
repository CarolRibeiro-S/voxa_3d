"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";

export interface PercentInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode"
  > {
  value: number;
  onValueChange: (value: number) => void;
  // Dígitos do modo inteiro (decimals = 0).
  maxDigits?: number;
  // 0 (inteiro) ou 2 (máscara de centavos, até 999,99).
  decimals?: 0 | 2;
  invalid?: boolean;
}

export const PercentInput = forwardRef<HTMLInputElement, PercentInputProps>(
  (
    {
      value,
      onValueChange,
      maxDigits = 3,
      decimals = 0,
      invalid,
      className,
      onFocus,
      onBlur,
      onClick,
      ...props
    },
    ref,
  ) => {
    // Texto em edição: permite o campo ficar vazio enquanto o usuário digita.
    const [draft, setDraft] = useState<string | null>(null);

    function handleChange(raw: string) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length > maxDigits) return;
      const clean = digits === "" ? "" : String(Number(digits));
      setDraft(clean);
      onValueChange(clean === "" ? 0 : Number(clean));
    }

    if (decimals === 2) {
      return (
        <MoneyInput
          {...props}
          ref={ref}
          value={value}
          onValueChange={onValueChange}
          decimals={2}
          max={999.99}
          prefix=""
          suffix="%"
          invalid={invalid}
          className={className}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={onClick}
        />
      );
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          invalid={invalid}
          value={draft ?? String(value)}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={(e) => {
            const input = e.currentTarget;
            requestAnimationFrame(() => input.select());
            onFocus?.(e);
          }}
          onClick={(e) => {
            e.currentTarget.select();
            onClick?.(e);
          }}
          onBlur={(e) => {
            setDraft(null);
            onBlur?.(e);
          }}
          className={cn("min-h-11 pr-10", className)}
          {...props}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-tinta/50">
          %
        </span>
      </div>
    );
  },
);
PercentInput.displayName = "PercentInput";
