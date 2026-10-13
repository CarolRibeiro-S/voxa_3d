"use client";

import { Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { MoreMenu, type MenuItem } from "@/components/ui/menu";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { switchTenant } from "@/lib/tenant-switch";

export interface StoreOption {
  tenantId: string;
  name: string;
  role: Role;
}

// Só aparece para quem participa de mais de uma loja.
export function StoreSwitcher({ stores, activeId }: { stores: StoreOption[]; activeId: string }) {
  const router = useRouter();
  if (stores.length < 2) return null;

  const items: MenuItem[] = stores.map((store) => ({
    key: store.tenantId,
    label: `${store.tenantId === activeId ? "✓ " : ""}${store.name} (${ROLE_LABEL[store.role]})`,
    onSelect: async () => {
      if (store.tenantId === activeId) return;
      const result = await switchTenant(store.tenantId);
      if (result.ok) router.replace("/");
    },
  }));

  return (
    <MoreMenu
      label="Trocar de loja"
      items={items}
      placement="down"
      icon={<Store size={20} aria-hidden="true" />}
    />
  );
}
