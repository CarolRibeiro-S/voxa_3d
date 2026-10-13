"use client";

import { HelpCircle } from "lucide-react";
import { useTour } from "@/components/tour/tour-provider";
import { MoreMenu, type MenuItem } from "@/components/ui/menu";

// Botão Ajuda do cabeçalho. "Ver tutorial desta tela" funciona mesmo com os tutoriais desativados.
export function HelpMenu() {
  const { enabled, hasTourHere, startCurrentPageTour, resetAll, setEnabled } = useTour();

  const items: MenuItem[] = [
    ...(hasTourHere
      ? [{ key: "here", label: "Ver tutorial desta tela", onSelect: startCurrentPageTour }]
      : []),
    { key: "reset", label: "Refazer todos os tutoriais", onSelect: resetAll },
    {
      key: "toggle",
      label: enabled ? "Desativar tutoriais" : "Ativar tutoriais",
      onSelect: () => setEnabled(!enabled),
    },
  ];

  return (
    <MoreMenu
      label="Ajuda"
      items={items}
      placement="down"
      icon={<HelpCircle size={20} aria-hidden="true" />}
    />
  );
}
