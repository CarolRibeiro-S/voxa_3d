"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  Printer,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { hasFeature, type Feature, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: Feature;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText, feature: "quotes" },
  { href: "/pedidos", label: "Pedidos", icon: KanbanSquare, feature: "orders_kanban" },
  { href: "/maquinas", label: "Máquinas", icon: Printer, feature: "calculator" },
  { href: "/materiais", label: "Materiais", icon: Boxes, feature: "calculator" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ plan, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-tinta/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white p-4 shadow-lg transition-transform md:static md:translate-x-0 md:border-r md:border-violeta/10 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2 pt-2">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-nevoa md:hidden"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, feature }) => {
            const locked = feature ? !hasFeature(plan, feature) : false;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-violeta text-white" : "text-tinta hover:bg-nevoa",
                  locked && !active && "text-tinta/50",
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {locked && <Lock size={14} aria-label="Indisponível no seu plano" />}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
