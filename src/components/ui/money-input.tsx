"use client";

import { forwardRef, type ClipboardEvent, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import {
  formatMoneyDigits,
  parseMoneyDigits,
  parsePastedMoney,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode" | "prefix"
  > {
  value: number;
  onValueChange: (value: number) => void;
  decimals?: number;
  max?: number;
  // Texto fixo à esquerda. Vazio remove o prefixo.
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onValueChange,
      decimals = 2,
      max = 999999.99,
      prefix = "R$",
      suffix,
      invalid,
      className,
      onFocus,
      onClick,
      ...props
    },
    ref,
  ) => {
    function commit(next: number) {
      // Dígitos que estouram o limite são ignorados.
      if (Number.isFinite(next) && next <= max) onValueChange(next);
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
      e.preventDefault();
      commit(parsePastedMoney(e.clipboardData.getData("text"), decimals));
    }

    return (
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-tinta/50">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          invalid={invalid}
          value={formatMoneyDigits(value, decimals)}
          onChange={(e) => commit(parseMoneyDigits(e.target.value, decimals))}
          onPaste={handlePaste}
          onFocus={(e) => {
            const input = e.currentTarget;
            requestAnimationFrame(() => input.select());
            onFocus?.(e);
          }}
          onClick={(e) => {
            e.currentTarget.select();
            onClick?.(e);
          }}
          className={cn("min-h-11", prefix ? "pl-11" : "", suffix ? "pr-16" : "", className)}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-medium text-tinta/50">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
