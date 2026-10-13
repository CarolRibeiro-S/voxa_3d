"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Menu suspenso simples: fecha com Esc e ao clicar fora. Botão de 44x44 com aria-label e title.

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  // Divisor antes do item (usado para separar as ações em vermelho).
  dividerBefore?: boolean;
}

export function MoreMenu({
  label,
  items,
  placement = "up",
  icon,
}: {
  label: string;
  items: MenuItem[];
  placement?: "up" | "down";
  // Ícone do botão. O padrão são os três pontos.
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        ref={triggerRef}
        label={label}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <MoreVertical size={18} aria-hidden="true" />}
      </IconButton>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute right-0 z-20 w-56 rounded-xl border border-violeta/10 bg-white py-1 shadow-lg",
            placement === "up" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.dividerBefore && <hr className="my-1 border-violeta/10" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center px-4 py-2 text-left text-sm font-medium leading-tight hover:bg-nevoa focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violeta",
                  item.danger && "text-red-700 hover:bg-red-50",
                )}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

