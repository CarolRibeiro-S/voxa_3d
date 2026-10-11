import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export interface FieldA11y {
  id: string;
  invalid: boolean;
  describedBy: string | undefined;
}

interface FormFieldProps {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: (a11y: FieldA11y) => ReactNode;
}

// Rótulo, campo, ajuda e erro ligados entre si por ids.
export function FormField({ id, label, help, error, children }: FormFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, invalid: !!error, describedBy })}
      {help && (
        <p id={helpId} className="mt-1 text-xs text-tinta/60">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
