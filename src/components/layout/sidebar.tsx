"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Boxes,
  Calculator,
  CreditCard,
  Droplet,
  FileText,
  History,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  Printer,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { IconButton } from "@/components/ui/button";
import { can, type Capability, type Role } from "@/lib/permissions";
import { hasFeature, type Feature, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: Feature;
  // Capacidade da função necessária para ver o item.
  capability: Capability;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, capability: "view_dashboard" },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText, feature: "quotes", capability: "view_quotes" },
  { href: "/pedidos", label: "Pedidos", icon: KanbanSquare, feature: "orders", capability: "view_orders" },
  { href: "/calculadora-fdm", label: "Calculadora FDM", icon: Calculator, feature: "calculator", capability: "use_calculators" },
  {
    href: "/calculadora-resina",
    label: "Calculadora de Resina",
    icon: Droplet,
    feature: "calculator",
    capability: "use_calculators",
  },
  { href: "/maquinas", label: "Máquinas", icon: Printer, feature: "calculator", capability: "view_catalog" },
  { href: "/materiais", label: "Materiais", icon: Boxes, feature: "calculator", capability: "view_catalog" },
  { href: "/modelos", label: "Modelos", icon: Box, capability: "view_models" },
  { href: "/historico", label: "Histórico", icon: History, capability: "view_history" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, capability: "view_settings" },
];

// Grupo "Conta": só o Dono vê. Gerente e Operador não têm essas capacidades.
const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/usuarios", label: "Usuários", icon: Users, capability: "view_users" },
  { href: "/assinatura", label: "Assinatura", icon: CreditCard, capability: "view_subscription" },
];

interface SidebarProps {
  plan: Plan;
  role: Role;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ plan, role, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const accountItems = ACCOUNT_ITEMS.filter((item) => can(role, item.capability));

  const renderItem = ({ href, label, icon: Icon, feature }: NavItem) => {
    const locked = feature ? !hasFeature(plan, feature) : false;
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium leading-tight transition-colors",
          active ? "bg-violeta text-white" : "text-tinta hover:bg-nevoa",
          locked && !active && "text-tinta/50",
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="min-w-0 flex-1">{label}</span>
        {locked && <Lock size={14} className="shrink-0" aria-label="Indisponível no seu plano" />}
      </Link>
    );
  };

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
          <IconButton label="Fechar menu" onClick={onClose} className="md:hidden">
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.filter((item) => can(role, item.capability)).map(renderItem)}
        </nav>
        {accountItems.length > 0 && (
          <nav aria-labelledby="sidebar-account" className="mt-6 flex flex-col gap-1">
            <p
              id="sidebar-account"
              className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-tinta/50"
            >
              Conta
            </p>
            {accountItems.map(renderItem)}
          </nav>
        )}
      </aside>
    </>
  );
}
