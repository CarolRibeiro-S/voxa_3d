"use client";

import { Menu } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { IconButton } from "@/components/ui/button";
import { HelpMenu } from "@/components/layout/help-menu";
import { StoreSwitcher, type StoreOption } from "@/components/layout/store-switcher";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function Topbar({
  onMenuClick,
  stores,
  activeTenantId,
}: {
  onMenuClick: () => void;
  stores: StoreOption[];
  activeTenantId: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-violeta/10 bg-white px-4">
      <div className="flex items-center gap-3">
        <IconButton label="Abrir menu" onClick={onMenuClick} className="md:hidden">
          <Menu size={22} aria-hidden="true" />
        </IconButton>
        <Logo className="text-xl md:hidden" />
      </div>
      <div className="flex items-center gap-2">
        <StoreSwitcher stores={stores} activeId={activeTenantId} />
        <HelpMenu />
        <SignOutButton variant="ghost" size="sm" />
      </div>
    </header>
  );
}
