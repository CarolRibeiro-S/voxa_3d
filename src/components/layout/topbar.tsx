"use client";

import { Menu } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-violeta/10 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl p-2 hover:bg-nevoa md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <Logo className="text-xl md:hidden" />
      </div>
      <SignOutButton variant="ghost" size="sm" />
    </header>
  );
}
